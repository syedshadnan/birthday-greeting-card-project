export type PaymentInput={customerName:string;bkashNumber:string;transactionId:string;amount:number}
export function validatePayment(input:PaymentInput){
 const errors:Partial<Record<keyof PaymentInput,string>>={}
 if(input.customerName.trim().length<2)errors.customerName='Please enter your name.'
 if(!/^01\d{9}$/.test(input.bkashNumber.replace(/[\s-]/g,'')))errors.bkashNumber='Enter an 11-digit bKash number starting with 01.'
 if(!/^[A-Za-z0-9]{8,20}$/.test(input.transactionId.trim()))errors.transactionId='Enter a valid transaction ID.'
 if(!Number.isInteger(input.amount)||input.amount<1)errors.amount='Payment amount is invalid.'
 return errors
}
