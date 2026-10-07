const fs = require('fs');

const values = [
  { name: 'Jan F1', val: 54215119 },
  { name: 'Feb F1', val: 55907112 },
  { name: 'Mar F1', val: 50276659 },
  { name: 'Apr F1', val: 52471358 },
  { name: 'May F1', val: 56570109 },
  { name: 'Mar SumU', val: 50276659.57 },
  { name: 'Mar SumT', val: 49778869.88 },
  { name: 'Apr SumU', val: 52471358.89 },
  { name: 'Apr SumT', val: 51951839.49 },
  { name: 'Mar FirstRowSumU', val: 49503014.72 },
  { name: 'Mar FirstRowSumT', val: 49015096.11 } // estimate
];

const target = 100223895;

for (let i=0; i<values.length; i++) {
  for (let j=i; j<values.length; j++) {
    const sum = values[i].val + values[j].val;
    if (Math.abs(sum - target) < 1000000) { // within 1M
      console.log(`Match? ${values[i].name} + ${values[j].name} = ${sum} (diff: ${target - sum})`);
    }
  }
}
