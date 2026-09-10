export const generateElectricityToken = () => {
  let sum = 0;
  const digits = [];

  for (let i = 0; i < 19; i++) {
    const d = Math.floor(Math.random() * 10);
    digits.push(d);
    sum += d;
  }

  const checkDigit = (sum * 9) % 10;
  digits.push(checkDigit);

  const token = digits.join('').match(/.{1,4}/g).join(' ');
  return token;
};