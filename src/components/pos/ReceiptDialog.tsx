import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptNumber: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number; // unit price (VAT-inclusive)
  }>;
  total: number; // total (VAT-inclusive)
  paymentMethod: string;
}

const VAT_RATE = 0.16; // 16%
const VAT_INCLUSIVE = true;

const calculateVAT = (amount: number) => {
  if (VAT_INCLUSIVE) {
    return amount * VAT_RATE / (1 + VAT_RATE);
  }
  return amount * VAT_RATE;
};

export const ReceiptDialog = ({
  open,
  onOpenChange,
  receiptNumber,
  items,
  total,
  paymentMethod,
}: ReceiptDialogProps) => {
  const now = new Date();
  // Build per-item data (subtotal, vat, net)
  const itemsWithVat = items.map((item) => {
    const subtotal = Number(item.price) * Number(item.quantity);
    const vat = calculateVAT(subtotal);
    const net = subtotal - vat;
    return { ...item, subtotal, vat, net };
  });

  const totalVAT = itemsWithVat.reduce((acc, it) => acc + it.vat, 0);
  const totalNet = Number(total) - totalVAT;

  const receiptContent = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    KAJIADO POS SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Receipt: ${receiptNumber}
Date: ${now.toLocaleString()}
Payment: ${paymentMethod.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${itemsWithVat
  .map(
    (it) =>
      `${it.name}
  ${it.quantity} x KES ${it.price.toFixed(2)} = KES ${it.subtotal.toFixed(2)}
    VAT: KES ${it.vat.toFixed(2)}  Net: KES ${it.net.toFixed(2)}`
  )
  .join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

VAT (${Math.round(VAT_RATE * 100)}%): KES ${totalVAT.toFixed(2)}
Amount (Excl. VAT): KES ${totalNet.toFixed(2)}

TOTAL (Incl. VAT): KES ${Number(total).toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Thank you for shopping!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt - ${receiptNumber}</title>
            <style>
              @media print {
                body { 
                  font-family: 'Courier New', monospace;
                  font-size: 12px;
                  width: 80mm;
                  margin: 0;
                  padding: 10px;
                }
                @page { margin: 0; }
              }
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                white-space: pre-wrap;
              }
            </style>
          </head>
          <body><pre>${receiptContent}</pre></body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Receipt ${receiptNumber}`,
          text: receiptContent,
        });
        toast.success('Receipt shared successfully');
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          toast.error('Failed to share receipt');
        }
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(receiptContent);
        toast.success('Receipt copied to clipboard');
      } catch (error) {
        toast.error('Failed to copy receipt');
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Sale Receipt</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {receiptContent}
            </pre>
          </div>

          <div className="overflow-x-auto bg-card/10 p-2 rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="p-1 text-left">Product</th>
                  <th className="p-1 text-right">Qty</th>
                  <th className="p-1 text-right">Unit</th>
                  <th className="p-1 text-right">Subtotal</th>
                  <th className="p-1 text-right">VAT</th>
                  <th className="p-1 text-right">Net</th>
                </tr>
              </thead>
              <tbody>
                {itemsWithVat.map((it, idx) => (
                  <tr key={idx} className="border-b">
                    <td className="p-1">{it.name}</td>
                    <td className="p-1 text-right">{it.quantity}</td>
                    <td className="p-1 text-right">KES {it.price.toFixed(2)}</td>
                    <td className="p-1 text-right">KES {it.subtotal.toFixed(2)}</td>
                    <td className="p-1 text-right">KES {it.vat.toFixed(2)}</td>
                    <td className="p-1 text-right">KES {it.net.toFixed(2)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3} className="p-1 font-semibold">Totals</td>
                  <td className="p-1 text-right font-semibold">KES {Number(total).toFixed(2)}</td>
                  <td className="p-1 text-right font-semibold">KES {totalVAT.toFixed(2)}</td>
                  <td className="p-1 text-right font-semibold">KES {totalNet.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePrint} className="flex-1">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button onClick={handleShare} variant="outline" className="flex-1">
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Note: To connect a receipt printer, use a compatible thermal printer
            with your device's print settings or Bluetooth/USB connection.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};