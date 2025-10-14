import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Search, Plus, CreditCard as Edit, Trash2, TriangleAlert as AlertTriangle, Upload, Tag } from 'lucide-react';
import { CSVImport } from '@/components/inventory/CSVImport';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { db, Product, Category } from '@/lib/db';

const Inventory = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    barcode: '',
    buyingPrice: '',
    sellingPrice: '',
    stock: '',
    reorderLevel: '10',
  });

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, [searchTerm]);

  const loadCategories = async () => {
    try {
      const cats = await db.categories.orderBy('name').toArray();
      setCategories(cats);
      if (cats.length > 0 && !formData.category) {
        setFormData(prev => ({ ...prev, category: cats[0].name }));
      }
    } catch (error) {
      toast.error('Failed to load categories');
    }
  };

  const loadProducts = async () => {
    try {
      let query = db.products.orderBy('name');

      if (searchTerm) {
        const results = await db.products
          .filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
          )
          .toArray();
        setProducts(results);
      } else {
        const results = await query.toArray();
        setProducts(results);
      }
    } catch (error) {
      toast.error('Failed to load products');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      category: categories.length > 0 ? categories[0].name : '',
      barcode: '',
      buyingPrice: '',
      sellingPrice: '',
      stock: '',
      reorderLevel: '10',
    });
    setEditingProduct(null);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      toast.error('Please enter a category name');
      return;
    }

    try {
      const existing = await db.categories
        .filter(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())
        .first();

      if (existing) {
        toast.error('Category already exists');
        return;
      }

      await db.categories.add({
        name: newCategoryName.trim(),
        createdAt: new Date()
      });

      toast.success('Category added successfully!');
      setNewCategoryName('');
      loadCategories();
    } catch (error) {
      toast.error('Failed to add category');
    }
  };

  const handleDeleteCategory = async (categoryId: number, categoryName: string) => {
    const productsWithCategory = await db.products
      .filter(p => p.category === categoryName)
      .count();

    if (productsWithCategory > 0) {
      toast.error(`Cannot delete category. ${productsWithCategory} product(s) are using this category.`);
      return;
    }

    if (!confirm(`Are you sure you want to delete the category "${categoryName}"?`)) {
      return;
    }

    try {
      await db.categories.delete(categoryId);
      toast.success('Category deleted successfully!');
      loadCategories();
    } catch (error) {
      toast.error('Failed to delete category');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      brand: product.brand,
      category: product.category,
      barcode: product.barcode || '',
      buyingPrice: product.buyingPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stock: product.stock.toString(),
      reorderLevel: product.reorderLevel.toString(),
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const productData = {
  name: formData.name,
  brand: formData.brand,
  category: formData.category,
  barcode: formData.barcode,
  buyingPrice: parseFloat(formData.buyingPrice),
  sellingPrice: parseFloat(formData.sellingPrice),
  stock: parseFloat(formData.stock),
  reorderLevel: parseFloat(formData.reorderLevel),
  updatedAt: new Date(),
};

      if (editingProduct) {
        await db.products.update(editingProduct.id!, productData);
        toast.success('Product updated!');
      } else {
        await db.products.add({
          ...productData,
          createdAt: new Date(),
        });
        toast.success('Product added!');
      }

      setIsDialogOpen(false);
      resetForm();
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save product');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await db.products.delete(id);
      toast.success('Product deleted!');
      loadProducts();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete product');
    }
  };

  const lowStockProducts = products.filter(
    p => p.stock <= p.reorderLevel
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <header className="border-b bg-card/50 backdrop-blur-sm p-4">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">Inventory Management</h1>
          </div>

          {userRole === 'admin' && (
            <div className="flex gap-2">
              <Button onClick={() => setIsCategoryDialogOpen(true)} variant="outline">
                <Tag className="mr-2 h-4 w-4" />
                Manage Categories
              </Button>
              <Button onClick={() => setIsImportOpen(true)} variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Import CSV
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingProduct ? 'Edit Product' : 'Add New Product'}
                  </DialogTitle>
                  <DialogDescription>
                    Fill in the product details below
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Product Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand">Brand *</Label>
                      <Input
                        id="brand"
                        value={formData.brand}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="barcode">Barcode</Label>
                      <Input
                        id="barcode"
                        value={formData.barcode}
                        onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="buyingPrice">Buying Price (KES) *</Label>
                      <Input
                        id="buyingPrice"
                        type="number"
                        step="0.01"
                        value={formData.buyingPrice}
                        onChange={(e) => setFormData({ ...formData, buyingPrice: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sellingPrice">Selling Price (KES) *</Label>
                      <Input
                        id="sellingPrice"
                        type="number"
                        step="0.01"
                        value={formData.sellingPrice}
                        onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock">Quantity in Stock *</Label>
                      <Input
                        id="stock"
                        type="number"
                        step="0.01"
                        value={formData.stock}
                        onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorderLevel">Low Stock Alert *</Label>
                      <Input
                        id="reorderLevel"
                        type="number"
                        step="0.01"
                        value={formData.reorderLevel}
                        onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">
                      {editingProduct ? 'Update' : 'Add'} Product
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsDialogOpen(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
            </div>
          )}
        </div>
      </header>

      <CSVImport
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
        onImportSuccess={loadProducts}
      />

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Add or remove product categories for your inventory
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Add New Category</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCategory();
                    }
                  }}
                />
                <Button onClick={handleAddCategory}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Existing Categories ({categories.length})</Label>
              <div className="max-h-[300px] space-y-2 overflow-y-auto rounded-md border p-2">
                {categories.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    No categories yet. Add one above.
                  </p>
                ) : (
                  categories.map((category) => (
                    <div
                      key={category.id}
                      className="flex items-center justify-between rounded-md border bg-card p-3"
                    >
                      <span className="font-medium">{category.name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteCategory(category.id!, category.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Button
              onClick={() => {
                setIsCategoryDialogOpen(false);
                setNewCategoryName('');
              }}
              className="w-full"
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <main className="container mx-auto p-4 space-y-4">
        {lowStockProducts.length > 0 && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Low Stock Alert ({lowStockProducts.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between rounded border border-destructive/50 bg-destructive/5 p-2">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Stock: {product.stock} (Alert at {product.reorderLevel})
                      </p>
                    </div>
                    {userRole === 'admin' && (
                      <Button size="sm" variant="outline" onClick={() => handleEdit(product)}>
                        Restock
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Product</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Stock</th>
                    <th className="p-2 text-right">Cost</th>
                    <th className="p-2 text-right">Price</th>
                    {userRole === 'admin' && <th className="p-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.brand}
                          </p>
                        </div>
                      </td>
                      <td className="p-2">
                        <Badge variant="outline">{product.category}</Badge>
                      </td>
                      <td className="p-2">
                        <span className={product.stock <= product.reorderLevel ? 'text-destructive font-bold' : ''}>
                          {product.stock}
                        </span>
                      </td>
                      <td className="p-2 text-right">
                        KES {product.buyingPrice.toFixed(2)}
                      </td>
                      <td className="p-2 text-right font-bold text-primary">
                        KES {product.sellingPrice.toFixed(2)}
                      </td>
                      {userRole === 'admin' && (
                        <td className="p-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEdit(product)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm('Delete this product?')) {
                                  handleDelete(product.id!);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {products.length === 0 && (
                    <tr>
                      <td colSpan={userRole === 'admin' ? 6 : 5} className="p-8 text-center text-muted-foreground">
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Inventory;
