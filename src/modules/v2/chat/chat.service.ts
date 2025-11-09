import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatSender } from './chat.entity';
import { OrderService } from 'src/modules/v1/order/order.service';
import { Order } from 'src/modules/v1/order/entities/order.entity';
import { Inventory } from 'src/modules/v1/inventory/entities/inventory.entity';
import { Warehouse } from 'src/modules/v1/warehouse/entities/warehouse.entity';
import {
  Customers,
  CustomerType,
} from 'src/modules/v1/customers/entities/customers.entity';
import { Product } from 'src/modules/v1/product/entity/product.entity';
import * as stringSimilarity from 'string-similarity';

interface SessionData {
  step?: string;
  customer?: Customers;
  orderPayload?: Partial<Order>;
  selectedProducts?: { product: Product; quantity: number }[];
  tempPhone?: string;
  phoneConfirmed?: boolean;
  paymentInfo?: {
    paidAmount?: number;
    paymentMethod?: string;
    transactionId?: string;
  } | null;
  tempProduct?: { product: Product; quantity: number };
  editField?: string;
}

const sessions: Record<string, SessionData> = {};

const dummyTransactions = [
  { transactionId: 'TXN12345', paidAmount: 50, paymentMethod: 'bkash' },
  { transactionId: 'TXN67890', paidAmount: 100, paymentMethod: 'nagad' },
  { transactionId: 'TXN11111', paidAmount: 200, paymentMethod: 'rocket' },
];

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage) private chatRepo: Repository<ChatMessage>,
    @InjectRepository(Inventory) private inventoryRepo: Repository<Inventory>,
    @InjectRepository(Warehouse) private warehouseRepo: Repository<Warehouse>,
    @InjectRepository(Customers) private customerRepo: Repository<Customers>,
    @InjectRepository(Product) private productRepo: Repository<Product>,
    private orderService: OrderService,
  ) {}

  private async saveMessage(sender: ChatSender, message: string, sessionId?: string) {
    const chat = this.chatRepo.create({ sender, message, sessionId });
    await this.chatRepo.save(chat);
  }

  private async listAvailableProducts(): Promise<{ text: string; options: string[] }> {
    const inventories = await this.inventoryRepo.find({ relations: ['product'] });
    if (!inventories.length)
      return { text: 'Sorry, no products are available right now.', options: [] };

    const text = inventories.map(inv => `• ${inv.product.name} — Stock: ${inv.stock ?? 0}`).join('\n');
    return { text, options: inventories.map(inv => inv.product.name) };
  }

  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^01[3-9]\d{8}$/;
    return phoneRegex.test(phone);
  }

  private generateOrderSummary(session: SessionData) {
    const isDhaka = session.customer.division?.toLowerCase() === 'dhaka';
    const deliveryCharge = isDhaka ? 70 : 120;

    let totalAmount = 0;
    const summaryLines = session.selectedProducts.map(p => {
      const productTotal = p.product.salePrice * p.quantity;
      totalAmount += productTotal;
      return `• ${p.product.name} x${p.quantity} = ${productTotal} Tk`;
    });
    totalAmount += deliveryCharge;

    const paidAmount = session.paymentInfo?.paidAmount ?? 0;
    let remainingAmount = totalAmount - paidAmount;
    if (remainingAmount < 0) remainingAmount = 0;

    const summary = `🧾 Order Summary:\n${summaryLines.join('\n')}\n` +
                    `Delivery Charge: ${deliveryCharge} Tk\n` +
                    `Total Amount: ${totalAmount} Tk\n` +
                    (paidAmount > 0 ? `Paid Amount: ${paidAmount} Tk\n` : '') +
                    `Remaining Amount to Pay: ${remainingAmount} Tk`;

    return summary;
  }

  async handleMessage(message: string, sessionId: string, organizationId: string) {
    if (!sessions[sessionId])
      sessions[sessionId] = { step: null, orderPayload: {}, selectedProducts: [] };

    const session = sessions[sessionId];
    const lower = message.toLowerCase().trim();
    await this.saveMessage('user', message, sessionId);

    if (['restart', 'cancel'].includes(lower)) {
      delete sessions[sessionId];
      sessions[sessionId] = { step: 'awaiting_customer_name' };
      const reply = "🔄 Chat restarted! Let's start fresh.\nWhat's your name?";
      await this.saveMessage('bot', reply, sessionId);
      return { reply };
    }

    let reply = '';
    let options: string[] | undefined;

    switch (session.step) {
      case 'awaiting_customer_name': {
        const allCustomers = await this.customerRepo.find({ where: { organizationId } });
        const names = allCustomers.map(c => c.customerName);
        const { bestMatch } = stringSimilarity.findBestMatch(message, names);

        if (bestMatch.rating > 0.8) {
          const matchedCustomer = allCustomers.find(c => c.customerName === bestMatch.target);
          session.customer = matchedCustomer;
          reply = `Hi ${matchedCustomer.customerName}, is this you? 😊\nPlease confirm your phone number.`;
          session.step = 'awaiting_customer_phone';
        } else {
          session.customer = { customerName: message, customerType: CustomerType.NonProbashi, organizationId } as Customers;
          reply = `Nice to meet you, ${message}! 😊\nCan I get your phone number, please?`;
          session.step = 'awaiting_customer_phone';
        }
        break;
      }

      case 'awaiting_customer_phone': {
        if (!this.isValidPhone(message)) {
          reply = '❌ Invalid phone number. Please type a valid Bangladeshi number like 017XXXXXXXX';
          break;
        }

        const existingCustomer = await this.customerRepo.findOne({ where: { customerPhoneNumber: message } });

        if (existingCustomer) {
          session.customer = existingCustomer;
          reply = `Welcome back, ${existingCustomer.customerName}! 🥰\nLet's confirm your delivery address.`;
        } else {
          session.customer.customerPhoneNumber = message;
          reply = `Thanks! Let's add your delivery address.\nWhich **Division** are you from?`;
        }
        session.step = 'awaiting_customer_division';
        break;
      }

      case 'awaiting_customer_division':
        session.customer.division = message;
        session.step = 'awaiting_customer_district';
        reply = 'Got it! What’s your **District**?';
        break;

      case 'awaiting_customer_district':
        session.customer.district = message;
        session.step = 'awaiting_customer_thana';
        reply = 'Perfect! What’s your **Thana/Upazila**?';
        break;

      case 'awaiting_customer_thana':
        session.customer.thana = message;
        session.step = 'awaiting_customer_address';
        reply = 'Almost done! Please type your **full address**.';
        break;

      case 'awaiting_customer_address': {
        session.customer.address = message;

        if (!session.customer.customer_Id) {
          session.customer.customer_Id = `CUST-${Date.now()}`;
          session.customer = await this.customerRepo.save(session.customer);
          reply = `✅ You’re registered successfully!\nYour Customer ID: ${session.customer.customer_Id}`;
        } else {
          reply = `Using your existing Customer ID: ${session.customer.customer_Id}`;
        }

        const productList = await this.listAvailableProducts();
        reply += `\n\nHere are the available products:\n${productList.text}\n\nPlease type a product name to order:`;
        session.step = 'awaiting_product_name';
        options = productList.options;
        break;
      }

      case 'awaiting_product_name': {
        const product = await this.productRepo.findOne({ where: { name: message } });
        if (!product) return { reply: `❌ I couldn’t find "${message}". Try another.` };

        session.selectedProducts.push({ product, quantity: 0 });
        session.step = 'awaiting_product_quantity';
        reply = `How many "${product.name}" would you like to order?`;
        break;
      }

      case 'awaiting_product_quantity': {
        const quantity = parseInt(message);
        if (isNaN(quantity) || quantity <= 0) return { reply: 'Please enter a valid number for quantity.' };

        const lastProduct = session.selectedProducts.at(-1);
        lastProduct.quantity = quantity;

        reply = `✅ Added ${lastProduct.product.name} x${quantity}.\nAdd more products? (yes/no)`;
        session.step = 'awaiting_add_more';
        break;
      }

      case 'awaiting_add_more':
        if (['yes', 'y'].includes(lower)) {
          const productList = await this.listAvailableProducts();
          reply = `Here’s our product list again:\n${productList.text}\n\nType the next product name.`;
          options = productList.options;
          session.step = 'awaiting_product_name';
        } else if (['no', 'n', 'done'].includes(lower)) {
          reply = `If you have already paid, please provide your transaction ID. Otherwise, type "skip" to continue without payment.`;
          session.step = 'awaiting_transaction_id';
        } else {
          reply = `Please type "yes" to add another or "no" to finish.`;
        }
        break;

      case 'awaiting_transaction_id':
        if (lower === 'skip') {
          session.paymentInfo = null;
          reply = `No pre-payment detected.\nProceeding to order summary...`;
        } else {
          const matchedTransaction = dummyTransactions.find(t => t.transactionId === message.trim());
          if (matchedTransaction) {
            session.paymentInfo = {
              transactionId: matchedTransaction.transactionId,
              paidAmount: matchedTransaction.paidAmount,
              paymentMethod: matchedTransaction.paymentMethod,
            };
            reply = `✅ Transaction ID matched! Paid Amount: ${matchedTransaction.paidAmount} Tk via ${matchedTransaction.paymentMethod}.`;
          } else {
            reply = `❌ Transaction ID not found. Please type a valid transaction ID or type "skip" to continue without payment.`;
            break;
          }
        }

        const summary = this.generateOrderSummary(session);
        reply += `\n\n${summary}\n\nWhat would you like to do?\n1️⃣ Confirm order\n2️⃣ Modify product quantity\n3️⃣ Add/remove products\n4️⃣ Edit delivery info`;
        session.step = 'awaiting_modification_choice';
        break;

      case 'awaiting_modification_choice':
        switch (lower) {
          case '1':
            session.step = 'awaiting_order_confirmation';
            return this.handleMessage('yes', sessionId, organizationId);
          case '2':
            reply = 'Which product quantity do you want to change? Type the product name:';
            session.step = 'awaiting_modify_quantity_product';
            break;
          case '3':
            const productList = await this.listAvailableProducts();
            reply = `Here’s the product list:\n${productList.text}\nType the product name to add/remove:`;
            session.step = 'awaiting_product_name';
            options = productList.options;
            break;
          case '4':
            reply = 'Which info do you want to edit? (name, phone, division, district, thana, address)';
            session.step = 'awaiting_edit_delivery_info';
            break;
          default:
            reply = 'Please type 1, 2, 3, or 4.';
        }
        break;

      case 'awaiting_modify_quantity_product': {
        const product = session.selectedProducts.find(p => p.product.name.toLowerCase() === lower);
        if (!product) return { reply: `Product not found in your selection.` };

        session.tempProduct = product;
        session.step = 'awaiting_new_quantity';
        reply = `Enter the new quantity for "${product.product.name}":`;
        break;
      }

      case 'awaiting_new_quantity': {
        const quantity = parseInt(message);
        if (isNaN(quantity) || quantity <= 0) return { reply: 'Please enter a valid number.' };

        session.tempProduct.quantity = quantity;
        delete session.tempProduct;
        session.step = 'awaiting_modification_choice';

        const summary = this.generateOrderSummary(session);
        reply = `✅ Quantity updated!\n\n${summary}\n\nWhat would you like to do next?\n1️⃣ Confirm order\n2️⃣ Modify quantity\n3️⃣ Add/remove products\n4️⃣ Edit delivery info`;
        break;
      }

      case 'awaiting_edit_delivery_info': {
        const fields = ['name','phone','division','district','thana','address'];
        if (!fields.includes(lower)) return { reply: 'Invalid choice. Choose one of: name, phone, division, district, thana, address' };

        session.editField = lower;
        session.step = 'awaiting_new_delivery_info';
        reply = `Enter new value for ${lower}:`;
        break;
      }

      case 'awaiting_new_delivery_info': {
        const field = session.editField;
        if (field === 'name') session.customer.customerName = message;
        else if (field === 'phone') session.customer.customerPhoneNumber = message;
        else if (field === 'division') session.customer.division = message;
        else if (field === 'district') session.customer.district = message;
        else if (field === 'thana') session.customer.thana = message;
        else if (field === 'address') session.customer.address = message;

        delete session.editField;
        session.step = 'awaiting_modification_choice';

        const summary = this.generateOrderSummary(session);
        reply = `✅ ${field} updated!\n\n${summary}\n\nWhat would you like to do next?\n1️⃣ Confirm order\n2️⃣ Modify quantity\n3️⃣ Add/remove products\n4️⃣ Edit delivery info`;
        break;
      }

      case 'awaiting_order_confirmation':
        if (['yes', 'y'].includes(lower)) {
          const warehouse = await this.warehouseRepo.findOne({
            where: { organizationId },
            order: { createdAt: 'ASC' },
          });
          const isDhaka = session.customer.division.toLowerCase() === 'dhaka';
          const shippingCharge = isDhaka ? 70 : 120;

          const orderPayload: Partial<any> = {
            customerId: session.customer.customer_Id,
            receiverName: session.customer.customerName,
            receiverPhoneNumber: session.customer.customerPhoneNumber,
            division: session.customer.division,
            district: session.customer.district,
            thana: session.customer.thana,
            receiverAddress: session.customer.address,
            locationId: warehouse?.id,
            orderSource: 'Chatbot',
            shippingCharge: shippingCharge,
            statusId: 1,
            products: session.selectedProducts.map((p) => ({
              productId: p.product.id,
              productQuantity: p.quantity,
            })),
            paymentHistory: session.paymentInfo ? [session.paymentInfo] : [],
          };

          const order = await this.orderService.createOrder(orderPayload as Order, organizationId);

          reply = `🎉 Order created successfully!\nOrder No: ${order.orderNumber || order.id}\n\nThank you for shopping! 🛍️`;
          delete sessions[sessionId];
        } else {
          reply = '❌ Order cancelled. Type "order" anytime to start again.';
          delete sessions[sessionId];
        }
        break;

      default:
        if (lower.includes('order')) {
          session.step = 'awaiting_customer_name';
          reply = "Let's get started with your order! 🛒\nWhat’s your name?";
        } else {
          reply = "👋 Hello! I’m your shopping assistant.\nType 'order' to start or 'help' for assistance.";
        }
    }

    await this.saveMessage('bot', reply, sessionId);
    return { reply, options };
  }
}
