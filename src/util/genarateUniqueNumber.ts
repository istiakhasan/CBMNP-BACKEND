export function generateUniqueOrderNumber(): string {
    const min = 1000000000;
    const max = 9999999999;
    const numericPart = Math.floor(Math.random() * (max - min + 1)) + min;
    const currentDate = new Date();
    const year = currentDate.getFullYear().toString().slice(2);
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    return `${year}${month}${numericPart}`;
  }