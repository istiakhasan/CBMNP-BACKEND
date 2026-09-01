import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PurchaseReturn, PurchaseReturnStatus } from './entities/purchase-return.entity';
import { PurchaseReturnItem } from './entities/purchase-return-item.entity';
import { GoodsReceiptNote, GRNStatus } from './entities/goods-receipt-note.entity';
import { GoodsReceiptItem } from './entities/goods-receipt-item.entity';
import { RFQ, RFQStatus } from './entities/rfq.entity';
import { SupplierQuotation } from './entities/supplier-quotation.entity';
import { InventoryItem } from '../inventory/entities/inventoryitem.entity';
import { Supplier } from '../supplier/entities/supplier.entity';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PurchaseReturn)
    private readonly purchaseReturnRepo: Repository<PurchaseReturn>,
    @InjectRepository(PurchaseReturnItem)
    private readonly returnItemRepo: Repository<PurchaseReturnItem>,
    @InjectRepository(GoodsReceiptNote)
    private readonly grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptItem)
    private readonly grnItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(RFQ)
    private readonly rfqRepo: Repository<RFQ>,
    @InjectRepository(SupplierQuotation)
    private readonly quotationRepo: Repository<SupplierQuotation>,
    @InjectRepository(InventoryItem)
    private readonly inventoryItemRepo: Repository<InventoryItem>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  // ================= PURCHASE RETURNS & DEBIT NOTES =================
  async createReturn(data: any, organizationId: string, userId?: string): Promise<PurchaseReturn> {
    const year = new Date().getFullYear();
    const returnNumber = `PR-${year}-${Date.now().toString().slice(-6)}`;

    let totalAmount = 0;
    (data.items || []).forEach((i: any) => {
      totalAmount += Number(i.quantity || 0) * Number(i.unitPrice || 0);
    });

    const pr = this.purchaseReturnRepo.create({
      returnNumber,
      returnDate: data.returnDate || new Date().toISOString().split('T')[0],
      supplierId: data.supplierId,
      warehouseId: data.warehouseId,
      procurementId: data.procurementId,
      totalAmount,
      status: PurchaseReturnStatus.DRAFT,
      reason: data.reason,
      createdById: userId,
      organizationId,
    });

    const saved = await this.purchaseReturnRepo.save(pr);

    if (data.items && Array.isArray(data.items)) {
      const items = data.items.map((i: any) =>
        this.returnItemRepo.create({
          purchaseReturnId: saved.id,
          productId: i.productId,
          quantity: Number(i.quantity || 0),
          unitPrice: Number(i.unitPrice || 0),
          totalPrice: Number(i.quantity || 0) * Number(i.unitPrice || 0),
          batchNumber: i.batchNumber,
          returnReason: i.returnReason,
          organizationId,
        }),
      );
      await this.returnItemRepo.save(items);
    }

    return this.purchaseReturnRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.product', 'supplier', 'warehouse'],
    }) as Promise<PurchaseReturn>;
  }

  async approveReturn(returnId: string, organizationId: string, userId?: string): Promise<PurchaseReturn> {
    return this.dataSource.transaction(async (manager) => {
      const pr = await manager.findOne(PurchaseReturn, {
        where: { id: returnId, organizationId },
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) throw new NotFoundException('Purchase return not found');
      if (pr.status !== PurchaseReturnStatus.DRAFT) {
        throw new BadRequestException(`Return already processed with status '${pr.status}'`);
      }

      // Deduct stock from warehouse
      for (const item of pr.items) {
        const inv = await manager.findOne(InventoryItem, {
          where: { locationId: pr.warehouseId, productId: item.productId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!inv || Number(inv.quantity || 0) < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock to return for product. Available: ${inv?.quantity || 0}, Return Qty: ${item.quantity}`,
          );
        }

        inv.quantity = Number(inv.quantity || 0) - item.quantity;
        await manager.save(inv);
      }

      const year = new Date().getFullYear();
      pr.debitNoteNumber = `DN-${year}-${Date.now().toString().slice(-6)}`;
      pr.status = PurchaseReturnStatus.APPROVED;

      return manager.save(pr);
    });
  }

  async getReturns(organizationId: string) {
    return this.purchaseReturnRepo.find({
      where: { organizationId },
      order: { returnDate: 'DESC' },
      relations: ['supplier', 'warehouse', 'items', 'items.product'],
    });
  }

  // ================= GOODS RECEIPT NOTE (GRN) & QA =================
  async createGRN(data: any, organizationId: string, userId?: string): Promise<GoodsReceiptNote> {
    return this.dataSource.transaction(async (manager) => {
      const year = new Date().getFullYear();
      const grnNumber = `GRN-${year}-${Date.now().toString().slice(-6)}`;

      const grn = manager.create(GoodsReceiptNote, {
        grnNumber,
        receivedDate: data.receivedDate || new Date().toISOString().split('T')[0],
        procurementId: data.procurementId,
        supplierId: data.supplierId,
        warehouseId: data.warehouseId,
        supplierDeliveryChallan: data.supplierDeliveryChallan,
        status: GRNStatus.ACCEPTED,
        inspectedById: userId,
        inspectionNotes: data.inspectionNotes,
        organizationId,
      });

      const savedGRN = await manager.save(grn);

      if (data.items && Array.isArray(data.items)) {
        for (const i of data.items) {
          const acceptedQty = Number(i.acceptedQuantity || 0);
          const rejectedQty = Number(i.rejectedQuantity || 0);

          const item = manager.create(GoodsReceiptItem, {
            grnId: savedGRN.id,
            productId: i.productId,
            orderedQuantity: Number(i.orderedQuantity || 0),
            deliveredQuantity: Number(i.deliveredQuantity || 0),
            acceptedQuantity: acceptedQty,
            rejectedQuantity: rejectedQty,
            batchNumber: i.batchNumber,
            expiryDate: i.expiryDate,
            rejectionReason: i.rejectionReason,
            organizationId,
          });
          await manager.save(item);

          // Add accepted quantity to warehouse inventory
          if (acceptedQty > 0) {
            let inv = await manager.findOne(InventoryItem, {
              where: { locationId: data.warehouseId, productId: i.productId },
              lock: { mode: 'pessimistic_write' },
            });

            if (!inv) {
              inv = manager.create(InventoryItem, {
                locationId: data.warehouseId,
                productId: i.productId,
                inventoryId: 'inv-default',
                quantity: acceptedQty,
                orderQue: 0,
                hoildQue: 0,
                processing: 0,
                wastageQuantity: 0,
              });
            } else {
              inv.quantity = Number(inv.quantity || 0) + acceptedQty;
            }
            await manager.save(inv);
          }
        }
      }

      return savedGRN;
    });
  }

  async getGRNs(organizationId: string) {
    return this.grnRepo.find({
      where: { organizationId },
      order: { receivedDate: 'DESC' },
      relations: ['supplier', 'warehouse', 'items', 'items.product'],
    });
  }

  // ================= RFQ & QUOTATION COMPARISON =================
  async createRFQ(data: any, organizationId: string): Promise<RFQ> {
    const year = new Date().getFullYear();
    const rfqNumber = `RFQ-${year}-${Date.now().toString().slice(-6)}`;

    const rfq = this.rfqRepo.create({
      rfqNumber,
      title: data.title,
      issueDate: data.issueDate || new Date().toISOString().split('T')[0],
      deadlineDate: data.deadlineDate,
      status: RFQStatus.SENT,
      requestedItems: data.requestedItems || [],
      termsAndConditions: data.termsAndConditions,
      organizationId,
    });

    return this.rfqRepo.save(rfq);
  }

  async submitSupplierQuotation(data: any, organizationId: string): Promise<SupplierQuotation> {
    const year = new Date().getFullYear();
    const quotationNumber = `SQ-${year}-${Date.now().toString().slice(-6)}`;

    const quote = this.quotationRepo.create({
      ...data,
      quotationNumber,
      quotedAmount: Number(data.quotedAmount || 0),
      leadTimeDays: Number(data.leadTimeDays || 7),
      organizationId,
    }) as unknown as SupplierQuotation;

    return this.quotationRepo.save(quote);
  }

  async getRFQComparison(rfqId: string, organizationId: string) {
    const rfq = await this.rfqRepo.findOne({
      where: { id: rfqId, organizationId },
      relations: ['quotations', 'quotations.supplier'],
    });

    if (!rfq) throw new NotFoundException('RFQ not found');

    return {
      rfq,
      comparison: rfq.quotations.map((q) => ({
        quotationId: q.id,
        supplierName: q.supplier?.company || q.supplier?.contactPerson || 'Supplier',
        supplierPhone: q.supplier?.phone,
        quotedAmount: Number(q.quotedAmount),
        leadTimeDays: q.leadTimeDays,
        isAwarded: q.isAwarded,
      })),
    };
  }

  async getRFQs(organizationId: string) {
    return this.rfqRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      relations: ['quotations', 'quotations.supplier'],
    });
  }
}
