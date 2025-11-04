import Dexie, { Table } from 'dexie';

export interface User {
  id?: number;
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'cashier';
  isSuperAdmin?: boolean;
  createdAt: Date;
}

export interface Category {
  id?: number;
  name: string;
  createdAt: Date;
}

export interface Product {
  id?: number;
  name: string;
  brand: string;
  category: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
  barcode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id?: number;
  receiptNumber: string;
  totalAmount: number;
  amountPaid: number;
  change: number;
  paymentMethod: 'cash' | 'mpesa' | 'card';
  cashierId: number;
  cashierName: string;
  createdAt: Date;
}

export interface SaleItem {
  id?: number;
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  issueDate: Date;
  dueDate: Date;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  paymentTerms: string;
  notes?: string;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InvoiceItem {
  id?: number;
  invoiceId: number;
  productId?: number;
  description: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  vatAmount: number;
  total: number;
}

export interface InvoicePayment {
  id?: number;
  invoiceId: number;
  paymentDate: Date;
  amount: number;
  paymentMethod: 'cash' | 'mpesa' | 'card' | 'bank_transfer';
  referenceNumber?: string;
  notes?: string;
  recordedBy: number;
  createdAt: Date;
}

export class LocalDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;
  categories!: Table<Category>;
  invoices!: Table<Invoice>;
  invoiceItems!: Table<InvoiceItem>;
  invoicePayments!: Table<InvoicePayment>;

  constructor() {
    super('KajiadoPOS');

    this.version(3).stores({
      users: '++id, email, role',
      products: '++id, name, brand, category, barcode, stock',
      sales: '++id, receiptNumber, cashierId, createdAt',
      saleItems: '++id, saleId, productId',
      categories: '++id, name',
      invoices: '++id, invoiceNumber, customerName, status, createdBy, createdAt',
      invoiceItems: '++id, invoiceId, productId',
      invoicePayments: '++id, invoiceId, paymentDate'
    });
  }

  async seedDefaultAdmin() {
    const adminCount = await this.users.where('role').equals('admin').count();

    if (adminCount === 0) {
      const hashedPassword = await this.hashPassword('admin123');
      await this.users.add({
        email: 'admin@kajiado.com',
        password: hashedPassword,
        fullName: 'System Administrator',
        role: 'admin',
        isSuperAdmin: true,
        createdAt: new Date()
      });
    }
  }

  async seedDefaultCategories() {
    const categoryCount = await this.categories.count();

    if (categoryCount === 0) {
      const defaultCategories = [
        'Groceries',
        'Beverages',
        'Snacks',
        'Personal Care',
        'Household Items',
        'Other'
      ];

      for (const name of defaultCategories) {
        await this.categories.add({
          name,
          createdAt: new Date()
        });
      }
    }
  }

  async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    const hash = await this.hashPassword(password);
    return hash === hashedPassword;
  }

  async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const todayStart = new Date(today.setHours(0, 0, 0, 0));
    const count = await this.invoices
      .where('createdAt')
      .aboveOrEqual(todayStart)
      .count();
    
    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${dateStr}-${sequence}`;
  }

  async updateInvoiceStatus(invoiceId: number) {
    const invoice = await this.invoices.get(invoiceId);
    if (!invoice) return;
    
    const today = new Date();
    let newStatus = invoice.status;
    
    if (invoice.balanceDue === 0) {
      newStatus = 'paid';
    } else if (today > invoice.dueDate && invoice.status !== 'paid') {
      newStatus = 'overdue';
    }
    
    if (newStatus !== invoice.status) {
      await this.invoices.update(invoiceId, { 
        status: newStatus,
        updatedAt: new Date()
      });
    }
  }

  async exportData() {
    const data = {
      users: await this.users.toArray(),
      products: await this.products.toArray(),
      sales: await this.sales.toArray(),
      saleItems: await this.saleItems.toArray(),
      categories: await this.categories.toArray(),
      invoices: await this.invoices.toArray(),
      invoiceItems: await this.invoiceItems.toArray(),
      invoicePayments: await this.invoicePayments.toArray(),
      exportDate: new Date().toISOString(),
      version: 3
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kajiado-cosmetics-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async importData(file: File) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      console.log('DB Import: Parsed data', data);

      const shouldClearExisting = confirm(
        'Do you want to clear existing data before importing? Click OK to clear, Cancel to merge.'
      );

      if (shouldClearExisting) {
        console.log('DB Import: Clearing existing data');
        await this.users.clear();
        await this.products.clear();
        await this.sales.clear();
        await this.saleItems.clear();
        await this.categories.clear();
      }

      console.log('DB Import: Adding new data');
      if (data.users && data.users.length > 0) {
        await this.users.bulkAdd(data.users);
        console.log('DB Import: Added', data.users.length, 'users');
      }
      if (data.products && data.products.length > 0) {
        await this.products.bulkAdd(data.products);
        console.log('DB Import: Added', data.products.length, 'products');
      }
      if (data.sales && data.sales.length > 0) {
        await this.sales.bulkAdd(data.sales);
        console.log('DB Import: Added', data.sales.length, 'sales');
      }
      if (data.saleItems && data.saleItems.length > 0) {
        await this.saleItems.bulkAdd(data.saleItems);
        console.log('DB Import: Added', data.saleItems.length, 'sale items');
      }
      if (data.categories && data.categories.length > 0) {
        await this.categories.bulkAdd(data.categories);
        console.log('DB Import: Added', data.categories.length, 'categories');
      }
      if (data.invoices && data.invoices.length > 0) {
        await this.invoices.bulkAdd(data.invoices);
        console.log('DB Import: Added', data.invoices.length, 'invoices');
      }
      if (data.invoiceItems && data.invoiceItems.length > 0) {
        await this.invoiceItems.bulkAdd(data.invoiceItems);
        console.log('DB Import: Added', data.invoiceItems.length, 'invoice items');
      }
      if (data.invoicePayments && data.invoicePayments.length > 0) {
        await this.invoicePayments.bulkAdd(data.invoicePayments);
        console.log('DB Import: Added', data.invoicePayments.length, 'invoice payments');
      }
      
      console.log('DB Import: Import completed successfully');
    } catch (error) {
      console.error('DB Import: Error during import', error);
      throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const db = new LocalDatabase();

db.seedDefaultAdmin();
db.seedDefaultCategories();
