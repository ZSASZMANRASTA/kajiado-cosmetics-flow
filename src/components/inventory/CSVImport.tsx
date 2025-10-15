import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { useToast } from "@/hooks/use-toast";
import { db, Category } from "@/lib/db";

interface CSVRow {
  name: string;
  brand?: string;
  category: string;
  barcode?: string;
  buying_price: string;
  selling_price: string;
  stock: string;
  reorder_level?: string;
}

interface ParsedProduct {
  name: string;
  brand: string;
  category: string;
  barcode?: string;
  buyingPrice: number;
  sellingPrice: number;
  stock: number;
  reorderLevel: number;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface CSVImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportSuccess: () => void;
}

export function CSVImport({ open, onOpenChange, onImportSuccess }: CSVImportProps) {
  const [csvData, setCSVData] = useState<ParsedProduct[]>([]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open]);

  const loadCategories = async () => {
    const cats = await db.categories.toArray();
    setCategories(cats);
  };

  const validateRow = async (row: CSVRow, rowIndex: number): Promise<{ valid: boolean; product?: ParsedProduct; errors: ValidationError[] }> => {
    const rowErrors: ValidationError[] = [];

    if (!row.name?.trim()) {
      rowErrors.push({ row: rowIndex, field: "name", message: "Product name is required" });
    }

    const validCategories = categories.map(c => c.name.toLowerCase());
    
    if (!row.category?.trim()) {
      rowErrors.push({ row: rowIndex, field: "category", message: "Category is required" });
    } else if (!validCategories.includes(row.category.toLowerCase())) {
  // Auto-create new category instead of blocking
  const newCategory = { name: row.category.trim(), createdAt: new Date() };
  await db.categories.add(newCategory);
}

    const buyingPrice = parseFloat(row.buying_price);
    if (isNaN(buyingPrice) || buyingPrice < 0) {
      rowErrors.push({ row: rowIndex, field: "buying_price", message: "Buying price must be a positive number" });
    }

    const sellingPrice = parseFloat(row.selling_price);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      rowErrors.push({ row: rowIndex, field: "selling_price", message: "Selling price must be a positive number" });
    }

    const quantity = parseFloat(row.stock);
    if (isNaN(quantity) || quantity < 0) {
      rowErrors.push({ row: rowIndex, field: "stock", message: "Quantity must be a non-negative number" });
    }

    const threshold = row.reorder_level ? parseInt(row.reorder_level) : 10;
    if (isNaN(threshold) || threshold < 0) {
      rowErrors.push({ row: rowIndex, field: "reorder_level", message: "Reorder level must be a non-negative number" });
    }

    if (rowErrors.length > 0) {
      return { valid: false, errors: rowErrors };
    }

    return {
      valid: true,
      product: {
        name: row.name.trim(),
        brand: row.brand?.trim() || '',
        category: row.category.trim(),
        barcode: row.barcode?.trim(),
        buyingPrice: buyingPrice,
        sellingPrice: sellingPrice,
        stock: quantity,
        reorderLevel: threshold,
      },
      errors: []
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('CSV Import: Starting file upload', file.name);

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        console.log('CSV Import: Parsing complete', results);
        const validProducts: ParsedProduct[] = [];
        const allErrors: ValidationError[] = [];

        for (const [index, row] of results.data.entries()) {
  const validation = await validateRow(row, index + 2);
  if (validation.valid && validation.product) {
    validProducts.push(validation.product);
  } else {
    allErrors.push(...validation.errors);
  }
}

        console.log('CSV Import: Valid products', validProducts.length);
        console.log('CSV Import: Errors', allErrors.length);

        setCSVData(validProducts);
        setErrors(allErrors);
        setImportResult(null);

        if (allErrors.length === 0 && validProducts.length > 0) {
          toast({
            title: "CSV validated successfully",
            description: `${validProducts.length} products ready to import`,
          });
        } else if (allErrors.length > 0) {
          toast({
            title: "Validation errors found",
            description: `Found ${allErrors.length} errors in the CSV file`,
            variant: "destructive",
          });
        }
      },
      error: (error) => {
        console.error('CSV Import: Parse error', error);
        toast({
          title: "CSV parsing error",
          description: error.message,
          variant: "destructive",
        });
      }
    });

    // Reset file input
    event.target.value = '';
  };

  const handleImport = async () => {
    if (csvData.length === 0) {
      toast({
        title: "No data to import",
        description: "Please upload a valid CSV file first",
        variant: "destructive",
      });
      return;
    }

    setImporting(true);
    setProgress(0);

    console.log('CSV Import: Starting import of', csvData.length, 'products');

    try {
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < csvData.length; i++) {
        const product = csvData[i];

        try {
          await db.products.add({
            ...product,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
          successCount++;
          console.log('CSV Import: Imported product', product.name);
        } catch (error) {
          failedCount++;
          console.error('CSV Import: Failed to import product', product.name, error);
        }

        setProgress(Math.round(((i + 1) / csvData.length) * 100));
      }

      setImportResult({ success: successCount, failed: failedCount });

      console.log('CSV Import: Completed', { successCount, failedCount });

      if (successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });
        onImportSuccess();
        
        // Reset after successful import
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        toast({
          title: "Import failed",
          description: "No products were imported successfully",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('CSV Import: Import error', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const sampleCategory = categories.length > 0 ? categories[0].name : "Groceries";
    const template = [
      ["name", "brand", "category", "barcode", "buying_price", "selling_price", "stock", "reorder_level"],
      ["Sample Product 1", "Brand A", sampleCategory, "123456789", "45.00", "65.00", "50", "10"],
      ["Sample Product 2", "Brand B", sampleCategory, "987654321", "120.00", "180.00", "25", "5"],
    ];

    const csv = Papa.unparse(template);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "product_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleClose = () => {
    setCSVData([]);
    setErrors([]);
    setImportResult(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Products from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import products into your inventory
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={downloadTemplate} variant="outline" className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download Template
            </Button>
            <label className="flex-1">
              <Button className="w-full" variant="default" asChild>
                <span>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </span>
              </Button>
              <input type="file" accept=".csv,text/csv,*/*"            onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {errors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Found {errors.length} validation errors:</div>
                <div className="max-h-32 overflow-y-auto text-sm space-y-1">
                  {errors.slice(0, 10).map((error, idx) => (
                    <div key={idx}>
                      Row {error.row}, {error.field}: {error.message}
                    </div>
                  ))}
                  {errors.length > 10 && <div>...and {errors.length - 10} more errors</div>}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {csvData.length > 0 && (
            <>
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  Ready to import {csvData.length} valid products
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg max-h-96 overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Brand</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {csvData.slice(0, 10).map((product, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>{product.brand || '-'}</TableCell>
                        <TableCell>{product.category}</TableCell>
                        <TableCell>KSh {product.buyingPrice.toFixed(2)}</TableCell>
                        <TableCell>KSh {product.sellingPrice.toFixed(2)}</TableCell>
                        <TableCell>{product.stock}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {csvData.length > 10 && (
                  <div className="p-2 text-center text-sm text-muted-foreground">
                    ...and {csvData.length - 10} more products
                  </div>
                )}
              </div>

              {importing && (
                <div className="space-y-2">
                  <Progress value={progress} />
                  <p className="text-sm text-center text-muted-foreground">
                    Importing... {progress}%
                  </p>
                </div>
              )}

              {importResult && (
                <Alert variant={importResult.failed > 0 ? "destructive" : "default"}>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Import completed: {importResult.success} successful
                    {importResult.failed > 0 && `, ${importResult.failed} failed`}
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2 justify-end">
                <Button onClick={handleClose} variant="outline" disabled={importing}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={importing || csvData.length === 0}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import {csvData.length} Products
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
