import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import Papa from "papaparse";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PRODUCT_CATEGORIES = [
  'soaps', 'lotions', 'oils', 'deodorants', 'hair_products',
  'petroleum_jelly', 'toothpaste', 'detergents', 'household_hygiene', 'other'
] as const;

type ProductCategory = typeof PRODUCT_CATEGORIES[number];

interface CSVRow {
  name: string;
  brand?: string;
  category: string;
  unit_size: string;
  barcode?: string;
  cost_price: string;
  selling_price: string;
  quantity_in_stock: string;
  low_stock_threshold?: string;
  supplier?: string;
}

interface ParsedProduct {
  name: string;
  brand?: string;
  category: ProductCategory;
  unit_size: string;
  barcode?: string;
  cost_price: number;
  selling_price: number;
  quantity_in_stock: number;
  low_stock_threshold: number;
  supplier?: string;
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
  const { toast } = useToast();

  const validateRow = (row: CSVRow, rowIndex: number): { valid: boolean; product?: ParsedProduct; errors: ValidationError[] } => {
    const rowErrors: ValidationError[] = [];

    if (!row.name?.trim()) {
      rowErrors.push({ row: rowIndex, field: "name", message: "Product name is required" });
    }

    if (!row.category?.trim()) {
      rowErrors.push({ row: rowIndex, field: "category", message: "Category is required" });
    } else if (!PRODUCT_CATEGORIES.includes(row.category.toLowerCase() as any)) {
      rowErrors.push({ row: rowIndex, field: "category", message: `Invalid category. Must be one of: ${PRODUCT_CATEGORIES.join(", ")}` });
    }

    if (!row.unit_size?.trim()) {
      rowErrors.push({ row: rowIndex, field: "unit_size", message: "Unit size is required" });
    }

    const costPrice = parseFloat(row.cost_price);
    if (isNaN(costPrice) || costPrice < 0) {
      rowErrors.push({ row: rowIndex, field: "cost_price", message: "Cost price must be a positive number" });
    }

    const sellingPrice = parseFloat(row.selling_price);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      rowErrors.push({ row: rowIndex, field: "selling_price", message: "Selling price must be a positive number" });
    }

    const quantity = parseInt(row.quantity_in_stock);
    if (isNaN(quantity) || quantity < 0) {
      rowErrors.push({ row: rowIndex, field: "quantity_in_stock", message: "Quantity must be a non-negative number" });
    }

    const threshold = row.low_stock_threshold ? parseInt(row.low_stock_threshold) : 10;
    if (isNaN(threshold) || threshold < 0) {
      rowErrors.push({ row: rowIndex, field: "low_stock_threshold", message: "Low stock threshold must be a non-negative number" });
    }

    if (rowErrors.length > 0) {
      return { valid: false, errors: rowErrors };
    }

    return {
      valid: true,
      product: {
        name: row.name.trim(),
        brand: row.brand?.trim(),
        category: row.category.toLowerCase() as ProductCategory,
        unit_size: row.unit_size.trim(),
        barcode: row.barcode?.trim(),
        cost_price: costPrice,
        selling_price: sellingPrice,
        quantity_in_stock: quantity,
        low_stock_threshold: threshold,
        supplier: row.supplier?.trim(),
      },
      errors: []
    };
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const validProducts: ParsedProduct[] = [];
        const allErrors: ValidationError[] = [];

        results.data.forEach((row, index) => {
          const validation = validateRow(row, index + 2); // +2 because row 1 is header
          if (validation.valid && validation.product) {
            validProducts.push(validation.product);
          } else {
            allErrors.push(...validation.errors);
          }
        });

        setCSVData(validProducts);
        setErrors(allErrors);
        setImportResult(null);

        if (allErrors.length === 0 && validProducts.length > 0) {
          toast({
            title: "CSV validated successfully",
            description: `${validProducts.length} products ready to import`,
          });
        }
      },
      error: (error) => {
        toast({
          title: "CSV parsing error",
          description: error.message,
          variant: "destructive",
        });
      }
    });
  };

  const handleImport = async () => {
    if (csvData.length === 0) return;

    setImporting(true);
    setProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const batchSize = 50;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < csvData.length; i += batchSize) {
        const batch = csvData.slice(i, i + batchSize);
        
        const productsWithCreatedBy = batch.map(product => ({
          ...product,
          created_by: user.id
        }));

        const { error } = await supabase
          .from('products')
          .insert(productsWithCreatedBy);

        if (error) {
          failedCount += batch.length;
          console.error('Batch import error:', error);
        } else {
          successCount += batch.length;
        }

        setProgress(Math.round(((i + batch.length) / csvData.length) * 100));
      }

      setImportResult({ success: successCount, failed: failedCount });

      if (successCount > 0) {
        toast({
          title: "Import completed",
          description: `Successfully imported ${successCount} products${failedCount > 0 ? `, ${failedCount} failed` : ''}`,
        });
        onImportSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
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
    const template = [
      ["name", "brand", "category", "unit_size", "barcode", "cost_price", "selling_price", "quantity_in_stock", "low_stock_threshold", "supplier"],
      ["Dove Soap Bar", "Dove", "soaps", "100g", "123456789", "45.00", "65.00", "50", "10", "Supplier ABC"],
      ["Nivea Lotion", "Nivea", "lotions", "200ml", "987654321", "120.00", "180.00", "25", "5", "Supplier XYZ"],
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
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
              />
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
                      <TableHead>Unit Size</TableHead>
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
                        <TableCell>{product.unit_size}</TableCell>
                        <TableCell>KSh {product.cost_price.toFixed(2)}</TableCell>
                        <TableCell>KSh {product.selling_price.toFixed(2)}</TableCell>
                        <TableCell>{product.quantity_in_stock}</TableCell>
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
                  disabled={importing || csvData.length === 0 || errors.length > 0}
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
