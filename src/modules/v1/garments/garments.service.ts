import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Like, Repository } from 'typeorm';
import { GarmentsBuyerOrder } from './entities/garmentsBuyerOrder.entity';
import { GarmentsBOM } from './entities/garmentsBom.entity';
import { GarmentsBOMItem } from './entities/garmentsBomItem.entity';
import { GarmentsPO } from './entities/garmentsPo.entity';
import { GarmentsPOItem } from './entities/garmentsPoItem.entity';
import { GarmentsInventory } from './entities/garmentsInventory.entity';
import { GarmentsInventoryLot } from './entities/garmentsInventoryLot.entity';
import { GarmentsInventoryAdjustment } from './entities/garmentsAdjustment.entity';
import { GarmentsMaterialIssue } from './entities/garmentsMaterialIssue.entity';
import { GarmentsInvoiceCounter } from './entities/garmentsInvoiceCounter.entity';
import paginationHelpers from '../../../helpers/paginationHelpers';

@Injectable()
export class GarmentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(GarmentsBuyerOrder)
    private readonly orderRepo: Repository<GarmentsBuyerOrder>,
    @InjectRepository(GarmentsBOM)
    private readonly bomRepo: Repository<GarmentsBOM>,
    @InjectRepository(GarmentsBOMItem)
    private readonly bomItemRepo: Repository<GarmentsBOMItem>,
    @InjectRepository(GarmentsPO)
    private readonly poRepo: Repository<GarmentsPO>,
    @InjectRepository(GarmentsPOItem)
    private readonly poItemRepo: Repository<GarmentsPOItem>,
    @InjectRepository(GarmentsInventory)
    private readonly inventoryRepo: Repository<GarmentsInventory>,
    @InjectRepository(GarmentsInventoryLot)
    private readonly lotRepo: Repository<GarmentsInventoryLot>,
    @InjectRepository(GarmentsInventoryAdjustment)
    private readonly adjRepo: Repository<GarmentsInventoryAdjustment>,
    @InjectRepository(GarmentsMaterialIssue)
    private readonly issueRepo: Repository<GarmentsMaterialIssue>,
    @InjectRepository(GarmentsInvoiceCounter)
    private readonly counterRepo: Repository<GarmentsInvoiceCounter>,
  ) {}

  // =========================================================================
  // NUMBER GENERATORS
  // =========================================================================
  async generateOrderNo(prefix = 'ORD'): Promise<string> {
    let counter = await this.counterRepo.findOne({ where: {} });
    if (!counter) {
      counter = this.counterRepo.create({ lastOrderNumber: 1000, lastPoNumber: 1000 });
      await this.counterRepo.save(counter);
    }
    counter.lastOrderNumber += 1;
    await this.counterRepo.save(counter);
    const year = new Date().getFullYear();
    return `${prefix}-${year}-${counter.lastOrderNumber}`;
  }

  async generatePoNo(): Promise<string> {
    let counter = await this.counterRepo.findOne({ where: {} });
    if (!counter) {
      counter = this.counterRepo.create({ lastOrderNumber: 1000, lastPoNumber: 1000 });
      await this.counterRepo.save(counter);
    }
    counter.lastPoNumber += 1;
    await this.counterRepo.save(counter);
    const year = new Date().getFullYear();
    return `PO-${year}-${counter.lastPoNumber}`;
  }

  // =========================================================================
  // 1. BUYER ORDERS & SAMPLE DEVELOPMENT
  // =========================================================================
  async createOrder(dto: any, organizationId: string) {
    const isSample = dto.orderType === 'SAMPLE';
    const prefix = isSample ? 'SMP' : 'ORD';
    const orderNo = dto.orderNo || (await this.generateOrderNo(prefix));
    const order = this.orderRepo.create({
      ...dto,
      orderType: dto.orderType || 'BULK',
      orderNo,
      organizationId,
    } as Partial<GarmentsBuyerOrder>);
    return await this.orderRepo.save(order as GarmentsBuyerOrder);
  }

  async getOrders(options: any, filterOptions: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    if (filterOptions?.orderType) {
      where.orderType = filterOptions.orderType;
    }

    if (filterOptions?.searchTerm) {
      where.buyerName = Like(`%${filterOptions.searchTerm}%`);
    }

    const [data, total] = await this.orderRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['boms', 'pos'],
    });

    return { data, total, page, limit };
  }

  async getAllOrdersList(organizationId: string) {
    return await this.orderRepo.find({
      where: organizationId ? { organizationId } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async getOrderById(id: string) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['boms', 'boms.items', 'pos', 'pos.items'],
    });
    if (!order) throw new NotFoundException('Garments buyer order not found');
    return order;
  }

  async updateOrder(id: string, dto: any) {
    await this.orderRepo.update(id, dto);
    return await this.getOrderById(id);
  }

  async deleteOrder(id: string) {
    const order = await this.getOrderById(id);
    await this.orderRepo.remove(order);
    return { success: true, message: 'Order deleted successfully' };
  }

  // =========================================================================
  // 2. BOM (BILL OF MATERIALS)
  // =========================================================================
  async createBom(dto: any, organizationId: string) {
    const { items = [], orderQuantity = 0, ...rest } = dto;
    const bom = this.bomRepo.create({
      ...rest,
      orderQuantity: Number(orderQuantity),
      status: 'draft',
      organizationId,
    } as Partial<GarmentsBOM>);
    const savedBom: GarmentsBOM = (await this.bomRepo.save(bom)) as GarmentsBOM;

    if (Array.isArray(items) && items.length > 0) {
      const bomItems = items.map((item: any) => {
        const consumption = Number(item.consumption || 0);
        const wastagePercent = Number(item.wastagePercent || 0);
        const totalQty =
          Number(item.totalQty) ||
          Number(orderQuantity) * consumption * (1 + wastagePercent / 100);
        const itemPrice = Number(item.itemPrice || 0);
        const totalCost = totalQty * itemPrice;

        return this.bomItemRepo.create({
          bom: savedBom,
          itemCategory: item.itemCategory || 'fabric',
          itemName: item.itemName,
          itemColor: item.itemColor || null,
          unit: item.unit || 'Yds',
          consumption,
          wastagePercent,
          totalQty: Number(totalQty.toFixed(4)),
          itemPrice,
          totalCost: Number(totalCost.toFixed(2)),
        } as Partial<GarmentsBOMItem>);
      });
      await this.bomItemRepo.save(bomItems as GarmentsBOMItem[]);
    }

    return await this.getBomById(savedBom.id);
  }

  async getBoms(options: any, filterOptions: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (filterOptions?.orderId) where.orderId = filterOptions.orderId;

    const [data, total] = await this.bomRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['order', 'items'],
    });

    return { data, total, page, limit };
  }

  async getAllBomsList(organizationId: string) {
    return await this.bomRepo.find({
      where: organizationId ? { organizationId } : {},
      relations: ['order', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getBomById(id: string) {
    const bom = await this.bomRepo.findOne({
      where: { id },
      relations: ['order', 'items'],
    });
    if (!bom) throw new NotFoundException('Garments BOM not found');
    return bom;
  }

  async updateBom(id: string, dto: any) {
    const bom = await this.getBomById(id);
    const { items, orderQuantity, ...rest } = dto;
    const targetOrderQty = orderQuantity !== undefined ? Number(orderQuantity) : bom.orderQuantity;

    Object.assign(bom, rest, { orderQuantity: targetOrderQty });
    await this.bomRepo.save(bom);

    if (Array.isArray(items)) {
      await this.bomItemRepo.delete({ bomId: id });
      const newItems = items.map((item: any) => {
        const consumption = Number(item.consumption || 0);
        const wastagePercent = Number(item.wastagePercent || 0);
        const totalQty =
          Number(item.totalQty) ||
          targetOrderQty * consumption * (1 + wastagePercent / 100);
        const itemPrice = Number(item.itemPrice || 0);
        const totalCost = totalQty * itemPrice;

        return this.bomItemRepo.create({
          bom,
          itemCategory: item.itemCategory || 'fabric',
          itemName: item.itemName,
          itemColor: item.itemColor || null,
          unit: item.unit || 'Yds',
          consumption,
          wastagePercent,
          totalQty: Number(totalQty.toFixed(4)),
          itemPrice,
          totalCost: Number(totalCost.toFixed(2)),
        } as Partial<GarmentsBOMItem>);
      });
      await this.bomItemRepo.save(newItems as GarmentsBOMItem[]);
    }

    return await this.getBomById(id);
  }

  async approveBom(id: string) {
    const bom = await this.getBomById(id);
    bom.status = 'approved';
    await this.bomRepo.save(bom);

    // Update inventory bookingQty
    for (const item of bom.items || []) {
      let inv = await this.inventoryRepo.findOne({
        where: { itemName: item.itemName, itemCategory: item.itemCategory },
      });
      if (!inv) {
        inv = this.inventoryRepo.create({
          itemName: item.itemName,
          itemCategory: item.itemCategory,
          unit: item.unit,
          itemColor: item.itemColor,
          bookingQty: Number(item.totalQty || 0),
          receiveQty: 0,
          issueQty: 0,
          stock: 0,
          unitPrice: item.itemPrice,
          organizationId: bom.organizationId,
        });
      } else {
        inv.bookingQty = Number(inv.bookingQty || 0) + Number(item.totalQty || 0);
      }
      await this.inventoryRepo.save(inv);
    }

    return bom;
  }

  async deleteBom(id: string) {
    const bom = await this.getBomById(id);
    await this.bomRepo.remove(bom);
    return { success: true, message: 'BOM deleted successfully' };
  }

  // =========================================================================
  // 3. PURCHASE ORDERS (PO) & APPROVALS
  // =========================================================================
  async createPo(dto: any, userName: string, organizationId: string) {
    const supplierPoNo = dto.supplierPoNo || (await this.generatePoNo());
    const items = dto.items || [];

    let subtotal = 0;
    const poItemsToCreate = items.map((item: any) => {
      const qty = Number(item.qty ?? item.quantity ?? 0);
      const unitCost = Number(item.unitCost ?? item.unitPrice ?? item.price ?? 0);
      const totalCost = qty * unitCost;
      subtotal += totalCost;
      return {
        ...item,
        qty,
        unitCost,
        totalCost,
        receivedQty: 0,
      };
    });

    const taxRatePercent = Number(dto.taxRatePercent || 0);
    const shippingCost = Number(dto.shippingCost || 0);
    const otherCharges = Number(dto.otherCharges || 0);
    const tax = subtotal * (taxRatePercent / 100);
    const totalAmount = subtotal + tax + shippingCost + otherCharges;

    const po = this.poRepo.create({
      ...dto,
      supplierPoNo,
      subtotal,
      totalAmount,
      status: 'draft',
      createdBy: userName || 'Admin',
      organizationId,
    } as Partial<GarmentsPO>);
    const savedPo: GarmentsPO = (await this.poRepo.save(po)) as GarmentsPO;

    if (poItemsToCreate.length > 0) {
      const createdItems = poItemsToCreate.map((item: any) =>
        this.poItemRepo.create({ ...item, po: savedPo } as Partial<GarmentsPOItem>),
      );
      await this.poItemRepo.save(createdItems as GarmentsPOItem[]);
    }

    return await this.getPoById(savedPo.id);
  }

  async getPos(options: any, filterOptions: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (filterOptions?.status) where.status = filterOptions.status;

    const [data, total] = await this.poRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['order', 'items', 'lots'],
    });

    return { data, total, page, limit };
  }

  async getAllPosList(organizationId: string) {
    return await this.poRepo.find({
      where: organizationId ? { organizationId } : {},
      relations: ['order', 'items'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPoById(id: string) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['order', 'items', 'lots'],
    });
    if (!po) throw new NotFoundException('Garments PO not found');
    return po;
  }

  async updatePo(id: string, dto: any) {
    const po = await this.getPoById(id);
    const items = dto.items;

    if (Array.isArray(items)) {
      await this.poItemRepo.delete({ poId: id });
      let subtotal = 0;
      const createdItems = items.map((item: any) => {
        const qty = Number(item.qty || 0);
        const unitCost = Number(item.unitCost || 0);
        const totalCost = qty * unitCost;
        subtotal += totalCost;
        return this.poItemRepo.create({
          po,
          ...item,
          qty,
          unitCost,
          totalCost,
          receivedQty: Number(item.receivedQty || 0),
        } as Partial<GarmentsPOItem>);
      });
      await this.poItemRepo.save(createdItems as GarmentsPOItem[]);

      const taxRatePercent = Number(dto.taxRatePercent ?? po.taxRatePercent ?? 0);
      const shippingCost = Number(dto.shippingCost ?? po.shippingCost ?? 0);
      const otherCharges = Number(dto.otherCharges ?? po.otherCharges ?? 0);
      const tax = subtotal * (taxRatePercent / 100);
      dto.subtotal = subtotal;
      dto.totalAmount = subtotal + tax + shippingCost + otherCharges;
    }

    delete dto.items;
    Object.assign(po, dto);
    await this.poRepo.save(po);
    return await this.getPoById(id);
  }

  async submitCheck(id: string, userName: string) {
    const po = await this.getPoById(id);
    po.status = 'pending_check';
    po.submittedBy = userName || 'Admin';
    po.submittedAt = new Date();
    return await this.poRepo.save(po);
  }

  async decideCheck(id: string, decision: string, note: string, userName: string) {
    const po = await this.getPoById(id);
    const now = new Date();
    if (decision === 'approved') {
      po.status = 'pending_approval';
      po.checkedBy = userName || 'Checker';
      po.checkedAt = now;
      po.rejectionNote = null;
    } else {
      po.status = 'rejected';
      po.rejectedAtStage = 'check';
      po.rejectedBy = userName || 'Checker';
      po.rejectedAt = now;
      po.rejectionNote = note || 'Rejected during checking';
    }
    return await this.poRepo.save(po);
  }

  async decideApproval(id: string, decision: string, note: string, userName: string) {
    const po = await this.getPoById(id);
    const now = new Date();
    if (decision === 'approved') {
      po.status = 'approved';
      po.approvedBy = userName || 'Approver';
      po.approvedAt = now;
      po.rejectionNote = null;
    } else {
      po.status = 'rejected';
      po.rejectedAtStage = 'approval';
      po.rejectedBy = userName || 'Approver';
      po.rejectedAt = now;
      po.rejectionNote = note || 'Rejected during final approval';
    }
    return await this.poRepo.save(po);
  }

  async deletePo(id: string) {
    const po = await this.getPoById(id);
    await this.poRepo.remove(po);
    return { success: true, message: 'PO deleted successfully' };
  }

  // =========================================================================
  // 4. PO RECEIVING & LOT TRACKING
  // =========================================================================
  async receivePoItems(dto: any, userName: string, organizationId: string) {
    const { poId, lotNumber, batchNumber, inHouseDate, items = [], remarks } = dto;
    const po = await this.getPoById(poId);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const item of items) {
        const poItem = po.items.find((i) => i.id === item.poItemId);
        if (!poItem) continue;

        const receiveQty = Number(item.receiveQty ?? item.receivedQuantity ?? 0);
        if (receiveQty <= 0) continue;

        // 1. Update PO Item receivedQty
        poItem.receivedQty = Number(poItem.receivedQty || 0) + receiveQty;
        await queryRunner.manager.save(GarmentsPOItem, poItem);

        // 2. Find or create GarmentsInventory item
        let inv = await queryRunner.manager.findOne(GarmentsInventory, {
          where: { itemName: poItem.itemName, itemCategory: poItem.itemCategory },
        });

        if (!inv) {
          inv = queryRunner.manager.create(GarmentsInventory, {
            itemName: poItem.itemName,
            itemCategory: poItem.itemCategory,
            unit: poItem.unit,
            itemColor: poItem.itemColor,
            bookingQty: poItem.qty,
            receiveQty: receiveQty,
            issueQty: 0,
            stock: receiveQty,
            unitPrice: poItem.unitCost,
            organizationId,
          });
        } else {
          inv.receiveQty = Number(inv.receiveQty || 0) + receiveQty;
          inv.stock = Number(inv.receiveQty || 0) - Number(inv.issueQty || 0);
        }
        const savedInv = await queryRunner.manager.save(GarmentsInventory, inv);

        // 3. Create GarmentsInventoryLot
        const lot = queryRunner.manager.create(GarmentsInventoryLot, {
          inventory: savedInv,
          inventoryId: savedInv.id,
          po,
          poId: po.id,
          lotNumber: lotNumber || `LOT-${new Date().getTime()}`,
          batchNumber: batchNumber || null,
          inHouseDate: inHouseDate || new Date().toISOString().split('T')[0],
          receivedQty: receiveQty,
          remainingQty: receiveQty,
          remarks: remarks || `Goods received for PO ${po.supplierPoNo}`,
        });
        await queryRunner.manager.save(GarmentsInventoryLot, lot);
      }

      await queryRunner.commitTransaction();
      return await this.getPoById(poId);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getReceivingProgress(poId: string) {
    const po = await this.getPoById(poId);
    const progress = (po.items || []).map((item) => ({
      poItemId: item.id,
      itemName: item.itemName,
      itemCategory: item.itemCategory,
      unit: item.unit,
      orderedQty: Number(item.qty || 0),
      receivedQty: Number(item.receivedQty || 0),
      remainingQty: Math.max(0, Number(item.qty || 0) - Number(item.receivedQty || 0)),
    }));
    return { poId, supplierPoNo: po.supplierPoNo, progress };
  }

  // =========================================================================
  // 5. INVENTORY LEDGER & LOTS
  // =========================================================================
  async getInventory(options: any, filterOptions: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (filterOptions?.category) where.itemCategory = filterOptions.category;
    if (filterOptions?.search) where.itemName = Like(`%${filterOptions.search}%`);

    const [data, total] = await this.inventoryRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['lots'],
    });

    return { data, total, page, limit };
  }

  async getInventoryCatalog(search: string) {
    const where: any = {};
    if (search) where.itemName = Like(`%${search}%`);
    return await this.inventoryRepo.find({ where, take: 50 });
  }

  async getLotsForItem(category: string, name: string) {
    const inv = await this.inventoryRepo.findOne({
      where: { itemCategory: category, itemName: name },
      relations: ['lots'],
    });
    return inv?.lots || [];
  }

  async directStockIn(dto: any, userName: string, organizationId: string) {
    const {
      itemCategory,
      itemName,
      itemColor,
      unit,
      receiveQty,
      unitPrice,
      sourceType,
      orderNo,
      supplierOrMarket,
      locationRack,
      remarks,
      approvalStatus,
    } = dto;

    const qty = Number(receiveQty || 0);
    if (qty <= 0) throw new BadRequestException('Quantity must be greater than 0');
    if (!itemName) throw new BadRequestException('Item name is required');

    let inv = await this.inventoryRepo.findOne({
      where: { itemName, itemCategory },
    });

    if (!inv) {
      inv = this.inventoryRepo.create({
        itemName,
        itemCategory: itemCategory || 'SEWING_TRIMS',
        unit: unit || 'Pcs',
        itemColor: itemColor || null,
        bookingQty: 0,
        receiveQty: qty,
        issueQty: 0,
        stock: qty,
        unitPrice: Number(unitPrice || 0),
        organizationId,
      });
    } else {
      inv.receiveQty = Number(inv.receiveQty || 0) + qty;
      inv.stock = Number(inv.receiveQty || 0) - Number(inv.issueQty || 0);
      if (unitPrice) inv.unitPrice = Number(unitPrice);
    }
    const savedInv = await this.inventoryRepo.save(inv);

    const timeStamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(2, 14);
    const lotNumber = `SMP-LOT-${timeStamp}`;
    const lotRemarks = [
      sourceType ? `[${sourceType}]` : '[Sample Inward]',
      orderNo ? `Ref Order/Sample: ${orderNo}` : '',
      supplierOrMarket ? `Source: ${supplierOrMarket}` : '',
      remarks ? `Note: ${remarks}` : '',
      `Recorded by: ${userName}`,
    ].filter(Boolean).join(' | ');

    const initialStatus = approvalStatus || 'pending';

    const lot = this.lotRepo.create({
      inventory: savedInv,
      inventoryId: savedInv.id,
      lotNumber,
      batchNumber: sourceType || 'SAMPLE_SWATCH',
      inHouseDate: new Date().toISOString().split('T')[0],
      receivedQty: qty,
      remainingQty: qty,
      locationRack: locationRack || 'Sample Room - Rack S1',
      qcRemarks: initialStatus === 'approved' ? 'Sample Approved / QC Passed' : 'Pending QC & Lab Dip Approval',
      approvalStatus: initialStatus,
      approvedBy: initialStatus === 'approved' ? userName : null,
      approvedAt: initialStatus === 'approved' ? new Date() : null,
      sourceType: sourceType || 'SAMPLE_MARKET_SOURCING',
      orderNo: orderNo || null,
      supplierOrMarket: supplierOrMarket || null,
      unitPrice: Number(unitPrice || 0),
      remarks: lotRemarks,
    });
    await this.lotRepo.save(lot);

    return {
      success: true,
      message: 'Sample material stock-in successful',
      inventory: savedInv,
      lot,
    };
  }

  async getSampleInwards(options: any, filterOptions: any) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);

    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .leftJoinAndSelect('lot.inventory', 'inventory');

    if (filterOptions?.approvalStatus) {
      qb.andWhere('lot.approvalStatus = :status', { status: filterOptions.approvalStatus });
    }

    if (filterOptions?.sourceType) {
      qb.andWhere('lot.sourceType = :sourceType', { sourceType: filterOptions.sourceType });
    }

    if (filterOptions?.search) {
      const s = `%${filterOptions.search}%`;
      qb.andWhere(
        '(lot.lotNumber LIKE :s OR lot.orderNo LIKE :s OR lot.supplierOrMarket LIKE :s OR inventory.itemName LIKE :s)',
        { s },
      );
    }

    qb.orderBy(`lot.${sortBy || 'createdAt'}`, (sortOrder?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC'));
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async decideSampleInwardApproval(id: string, decision: 'approved' | 'rejected', note: string, userName: string) {
    const lot = await this.lotRepo.findOne({ where: { id }, relations: ['inventory'] });
    if (!lot) throw new NotFoundException('Sample inward record not found');

    const prevStatus = lot.approvalStatus;
    lot.approvalStatus = decision;
    lot.approvedBy = userName;
    lot.approvedAt = new Date();
    lot.approvalNote = note || `Sample material ${decision} by ${userName}`;
    lot.qcRemarks = decision === 'approved' ? 'Quality & Spec Approved' : 'Rejected - Quality / Shade discrepancy';

    if (decision === 'rejected' && prevStatus !== 'rejected' && lot.inventory) {
      const inv = lot.inventory;
      inv.receiveQty = Math.max(0, Number(inv.receiveQty || 0) - Number(lot.receivedQty || 0));
      inv.stock = Math.max(0, Number(inv.receiveQty || 0) - Number(inv.issueQty || 0));
      await this.inventoryRepo.save(inv);
    } else if (decision === 'approved' && prevStatus === 'rejected' && lot.inventory) {
      const inv = lot.inventory;
      inv.receiveQty = Number(inv.receiveQty || 0) + Number(lot.receivedQty || 0);
      inv.stock = Math.max(0, Number(inv.receiveQty || 0) - Number(inv.issueQty || 0));
      await this.inventoryRepo.save(inv);
    }

    return await this.lotRepo.save(lot);
  }

  // =========================================================================
  // 6. INVENTORY ADJUSTMENTS
  // =========================================================================
  async proposeAdjustment(dto: any, userName: string, organizationId: string) {
    const { inventoryId, quantityDelta, reason, remarks } = dto;
    const inv = await this.inventoryRepo.findOne({ where: { id: inventoryId } });
    if (!inv) throw new NotFoundException('Inventory item not found');

    const adj = this.adjRepo.create({
      inventory: inv,
      quantityDelta: Number(quantityDelta),
      reason,
      remarks,
      status: 'pending',
      proposedBy: userName || 'Admin',
      organizationId,
    } as Partial<GarmentsInventoryAdjustment>);
    return await this.adjRepo.save(adj as GarmentsInventoryAdjustment);
  }

  async getAdjustments(options: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;

    const [data, total] = await this.adjRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['inventory'],
    });

    return { data, total, page, limit };
  }

  async getPendingAdjustments(organizationId: string) {
    return await this.adjRepo.find({
      where: { status: 'pending', ...(organizationId ? { organizationId } : {}) },
      relations: ['inventory'],
      order: { createdAt: 'DESC' },
    });
  }

  async decideAdjustment(id: string, decision: string, note: string, userName: string) {
    const adj = await this.adjRepo.findOne({ where: { id }, relations: ['inventory'] });
    if (!adj) throw new NotFoundException('Adjustment request not found');

    adj.status = decision === 'approved' ? 'approved' : 'rejected';
    adj.decidedBy = userName || 'Admin';
    adj.decidedAt = new Date();
    adj.decisionNote = note;

    if (decision === 'approved' && adj.inventory) {
      const delta = Number(adj.quantityDelta || 0);
      adj.inventory.stock = Number(adj.inventory.stock || 0) + delta;
      await this.inventoryRepo.save(adj.inventory);
    }

    return await this.adjRepo.save(adj);
  }

  // =========================================================================
  // 7. MATERIAL FLOOR ISSUE & RETURNS
  // =========================================================================
  async createMaterialIssue(dto: any, userName: string, organizationId: string) {
    const { bomId, inventoryId, quantity, qty, lineNo, lotNumber, floorSection, issuedTo, remarks } = dto;
    const inv = await this.inventoryRepo.findOne({ where: { id: inventoryId } });
    if (!inv) throw new NotFoundException('Inventory item not found');

    // Accept both 'quantity' (frontend form field) and 'qty' (legacy) field names
    const issueQty = Number(quantity ?? qty ?? 0);
    if (issueQty <= 0) throw new BadRequestException('Issue quantity must be greater than 0');
    if (issueQty > Number(inv.stock || 0)) {
      throw new BadRequestException(
        `Insufficient stock. Available: ${inv.stock} ${inv.unit}, Requested: ${issueQty}`,
      );
    }

    let bom: GarmentsBOM | null = null;
    if (bomId) {
      bom = await this.bomRepo.findOne({ where: { id: bomId } });
    }

    const issue = this.issueRepo.create({
      bom: bom || undefined,
      inventory: inv,
      type: 'ISSUE',
      qty: issueQty,
      lineNo,
      lotNumber,
      floorSection: floorSection || null,
      issuedTo: issuedTo || null,
      issuedBy: userName || 'Store Keeper',
      remarks,
      organizationId,
    } as Partial<GarmentsMaterialIssue>);
    const savedIssue = await this.issueRepo.save(issue as GarmentsMaterialIssue);

    // Deduct from inventory stock
    inv.issueQty = Number(inv.issueQty || 0) + issueQty;
    inv.stock = Number(inv.receiveQty || 0) - Number(inv.issueQty || 0);
    await this.inventoryRepo.save(inv);

    return savedIssue;
  }

  async createMaterialReturn(dto: any, userName: string, organizationId: string) {
    const { bomId, inventoryId, quantity, qty, lineNo, lotNumber, floorSection, issuedTo, remarks } = dto;
    const inv = await this.inventoryRepo.findOne({ where: { id: inventoryId } });
    if (!inv) throw new NotFoundException('Inventory item not found');

    // Accept both 'quantity' (frontend form field) and 'qty' (legacy) field names
    const returnQty = Number(quantity ?? qty ?? 0);
    if (returnQty <= 0) throw new BadRequestException('Return quantity must be greater than 0');

    let bom: GarmentsBOM | null = null;
    if (bomId) {
      bom = await this.bomRepo.findOne({ where: { id: bomId } });
    }

    const ret = this.issueRepo.create({
      bom: bom || undefined,
      inventory: inv,
      type: 'RETURN',
      qty: returnQty,
      lineNo,
      lotNumber,
      floorSection: floorSection || null,
      issuedTo: issuedTo || null,
      receivedBy: userName || 'Store Keeper',
      remarks: remarks || 'Leftover material returned from floor',
      organizationId,
    } as Partial<GarmentsMaterialIssue>);
    const savedReturn = await this.issueRepo.save(ret as GarmentsMaterialIssue);

    // Add back to inventory stock
    inv.issueQty = Math.max(0, Number(inv.issueQty || 0) - returnQty);
    inv.stock = Number(inv.receiveQty || 0) - Number(inv.issueQty || 0);
    await this.inventoryRepo.save(inv);

    return savedReturn;
  }

  async getMaterialIssues(options: any, filterOptions: any, organizationId: string) {
    const { page, limit, skip, sortBy, sortOrder } = paginationHelpers(options);
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (filterOptions?.bomId) where.bomId = filterOptions.bomId;
    if (filterOptions?.type) where.type = filterOptions.type;

    const [data, total] = await this.issueRepo.findAndCount({
      where,
      skip,
      take: limit,
      order: { [sortBy || 'createdAt']: sortOrder || 'DESC' },
      relations: ['bom', 'inventory'],
    });

    return { data, total, page, limit };
  }

  async getMaterialSummaryByBom(bomId: string) {
    const bom = await this.getBomById(bomId);
    const issues = await this.issueRepo.find({
      where: { bomId },
      relations: ['inventory'],
    });

    const issuedMap: Record<string, number> = {};
    issues.forEach((iss) => {
      const key = iss.inventoryId || iss.inventory?.itemName;
      const amount = iss.type === 'RETURN' ? -Number(iss.qty || 0) : Number(iss.qty || 0);
      issuedMap[key] = (issuedMap[key] || 0) + amount;
    });

    const summary = (bom.items || []).map((bItem) => {
      const issuedQty = issuedMap[bItem.itemName] || 0;
      const requiredQty = Number(bItem.totalQty || 0);
      return {
        bomItemId: bItem.id,
        itemName: bItem.itemName,
        itemCategory: bItem.itemCategory,
        unit: bItem.unit,
        requiredQty,
        issuedQty,
        balanceQty: Math.max(0, requiredQty - issuedQty),
      };
    });

    return { bomId, styleNo: bom.styleNo, styleName: bom.styleName, summary };
  }

  // =========================================================================
  // 8. DASHBOARD METRICS
  // =========================================================================
  async getDashboardMetrics(organizationId: string) {
    const orgWhere = organizationId ? { organizationId } : {};

    const [ordersCount, pendingPosCount, inventoryCount, bomsCount, recentPos] =
      await Promise.all([
        this.orderRepo.count({ where: orgWhere }),
        this.poRepo.count({
          where: { status: 'pending_approval', ...(organizationId ? { organizationId } : {}) },
        }),
        this.inventoryRepo.count({ where: orgWhere }),
        this.bomRepo.count({ where: orgWhere }),
        this.poRepo.find({
          where: orgWhere,
          take: 6,
          order: { createdAt: 'DESC' },
          relations: ['order', 'items'],
        }),
      ]);

    return {
      orders: ordersCount,
      pendingPos: pendingPosCount,
      inventoryItems: inventoryCount,
      boms: bomsCount,
      recentPos,
    };
  }
}
