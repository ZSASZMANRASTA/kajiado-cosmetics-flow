import { Invoice, InvoiceItem } from '@/lib/db';
import { format } from 'date-fns';

interface InvoicePrintViewProps {
  invoice: Invoice;
  items: InvoiceItem[];
}

const InvoicePrintView = ({ invoice, items }: InvoicePrintViewProps) => {
  return (
    <div className="hidden print:block p-8 bg-white text-black">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="border-b-2 border-gray-800 pb-4">
          <h1 className="text-3xl font-bold">KAJIADO COSMETICS</h1>
          <p className="text-sm">Kajiado Town, Kenya</p>
          <p className="text-sm">Phone: +254 XXX XXX XXX</p>
          <p className="text-sm">Email: info@kajiadocosmetics.com</p>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h2 className="font-bold text-lg mb-2">BILL TO:</h2>
            <p className="font-semibold">{invoice.customerName}</p>
            {invoice.customerPhone && <p>Phone: {invoice.customerPhone}</p>}
            {invoice.customerEmail && <p>Email: {invoice.customerEmail}</p>}
            {invoice.customerAddress && <p>Address: {invoice.customerAddress}</p>}
          </div>
          <div className="text-right">
            <h2 className="text-2xl font-bold mb-2">INVOICE</h2>
            <p><span className="font-semibold">Invoice #:</span> {invoice.invoiceNumber}</p>
            <p><span className="font-semibold">Issue Date:</span> {format(new Date(invoice.issueDate), 'dd/MM/yyyy')}</p>
            <p><span className="font-semibold">Due Date:</span> {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</p>
            <p><span className="font-semibold">Payment Terms:</span> {invoice.paymentTerms}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-gray-800">
              <th className="text-left py-2">Description</th>
              <th className="text-right py-2">Qty</th>
              <th className="text-right py-2">Unit Price</th>
              <th className="text-right py-2">Subtotal</th>
              <th className="text-right py-2">VAT</th>
              <th className="text-right py-2">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-300">
                <td className="py-2">{item.description}</td>
                <td className="text-right py-2">{item.quantity}</td>
                <td className="text-right py-2">KES {item.unitPrice.toLocaleString()}</td>
                <td className="text-right py-2">KES {item.subtotal.toLocaleString()}</td>
                <td className="text-right py-2">KES {item.vatAmount.toLocaleString()}</td>
                <td className="text-right py-2 font-semibold">KES {item.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-2">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span className="font-semibold">KES {invoice.subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-1">
              <span>VAT (16%):</span>
              <span className="font-semibold">KES {invoice.vatAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-t-2 border-gray-800 text-lg font-bold">
              <span>Total:</span>
              <span>KES {invoice.totalAmount.toLocaleString()}</span>
            </div>
            {invoice.amountPaid > 0 && (
              <>
                <div className="flex justify-between py-1">
                  <span>Amount Paid:</span>
                  <span className="font-semibold">KES {invoice.amountPaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between py-2 border-t border-gray-400 font-bold">
                  <span>Balance Due:</span>
                  <span>KES {invoice.balanceDue.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-2">Notes:</h3>
            <p className="text-sm whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}

        {/* Payment Instructions */}
        <div className="border-t pt-4 text-sm">
          <h3 className="font-semibold mb-2">Payment Instructions:</h3>
          <p>Please make payment by the due date using one of the following methods:</p>
          <ul className="list-disc list-inside mt-2">
            <li>M-PESA: Pay Bill XXXXX, Account: {invoice.invoiceNumber}</li>
            <li>Bank Transfer: Bank ABC, Account: XXXXXXXXXX</li>
            <li>Cash: Visit our store in Kajiado Town</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600 pt-4 border-t">
          <p>Thank you for your business!</p>
          <p className="mt-1">This is a computer-generated invoice and is valid without signature.</p>
        </div>
      </div>
    </div>
  );
};

export default InvoicePrintView;
