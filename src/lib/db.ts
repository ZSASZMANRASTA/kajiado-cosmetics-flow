import Dexie, { Table } from 'dexie';

export interface User {
  id?: number;
  email: string;
  password: string;
  fullName: string;
  role: 'admin' | 'cashier';
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

export class LocalDatabase extends Dexie {
  users!: Table<User>;
  products!: Table<Product>;
  sales!: Table<Sale>;
  saleItems!: Table<SaleItem>;

  constructor() {
    super('KajiadoCosmetics');

    this.version(1).stores({
      users: '++id, email, role',
      products: '++id, name, brand, category, barcode, stock',
      sales: '++id, receiptNumber, cashierId, createdAt',
      saleItems: '++id, saleId, productId'
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
        createdAt: new Date()
      });
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

  async exportData() {
    const data = {
      users: await this.users.toArray(),
      products: await this.products.toArray(),
      sales: await this.sales.toArray(),
      saleItems: await this.saleItems.toArray(),
      exportDate: new Date().toISOString(),
      version: 1
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
    const text = await file.text();
    const data = JSON.parse(text);

    const shouldClearExisting = confirm(
      'Do you want to clear existing data before importing? Click OK to clear, Cancel to merge.'
    );

    if (shouldClearExisting) {
      await this.users.clear();
      await this.products.clear();
      await this.sales.clear();
      await this.saleItems.clear();
    }

    if (data.users) await this.users.bulkAdd(data.users);
    if (data.products) await this.products.bulkAdd(data.products);
    if (data.sales) await this.sales.bulkAdd(data.sales);
    if (data.saleItems) await this.saleItems.bulkAdd(data.saleItems);
  }
}

export const db = new LocalDatabase();

db.seedDefaultAdmin();
