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
    price: number;
  }>;
  total: number;
  paymentMethod: string;
}

export const ReceiptDialog = ({
  open,
  onOpenChange,
  receiptNumber,
  items,
  total,
  paymentMethod,
}: ReceiptDialogProps) => {
  const receiptContent = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    KAJIADO POS SYSTEM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Receipt: ${receiptNumber}
Date: ${new Date().toLocaleString()}
Payment: ${paymentMethod.toUpperCase()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${items.map(item => 
  `${item.name}\n${item.quantity} x KES ${item.price.toFixed(2)} = KES ${(item.quantity * item.price).toFixed(2)}`
).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TOTAL: KES ${total.toFixed(2)}

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
          <body>${receiptContent}</body>
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
