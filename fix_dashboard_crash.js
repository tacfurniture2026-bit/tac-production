const fs = require('fs');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  // Fix null reference error for urgent-orders-grid
  code = code.replace(
      "$('#urgent-orders-grid').innerHTML = generateUrgentHtml(gridOrders);",
      "const elGrid = $('#urgent-orders-grid'); if (elGrid) elGrid.innerHTML = generateUrgentHtml(gridOrders);"
  );
  code = code.replace(
      "$('#urgent-orders-other').innerHTML = generateUrgentHtml(otherOrders);",
      "const elOther = $('#urgent-orders-other'); if (elOther) elOther.innerHTML = generateUrgentHtml(otherOrders);"
  );
  code = code.replace(
      "$('#urgent-orders-pao').innerHTML = generateUrgentHtml(paoOrders);",
      "const elPao = $('#urgent-orders-pao'); if (elPao) elPao.innerHTML = generateUrgentHtml(paoOrders);"
  );

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('Dashboard crash fixed');
