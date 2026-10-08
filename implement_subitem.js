const fs = require('fs');

function patchHtml(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');

  const targetCount = /<input type="number" id="defect-reg-count" class="form-input" value="1" min="1" required>\s*<\/div>\s*<button type="submit"/g;
  const newHtml = `<input type="number" id="defect-reg-count" class="form-input" value="1" min="1" required>
                                </div>
                                <div class="form-group" style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem;">
                                    <input type="checkbox" id="defect-reg-recreate" checked style="width: 20px; height: 20px;">
                                    <label for="defect-reg-recreate" style="margin:0; font-weight: normal; cursor: pointer;">再製作用のサブアイテム（枝番）を自動追加する</label>
                                </div>
                                <button type="submit"`;
  
  if (!code.includes('defect-reg-recreate')) {
      code = code.replace(targetCount, newHtml);
  }

  fs.writeFileSync(filename, code);
}

patchHtml('index.html');
patchHtml('mobile_source.html');
console.log('HTML updated');

function patchJs(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldLogic = `  // 不良発生工程を完了から未完了（completed配列から除外）に戻す
  if (Array.isArray(item.completed)) {
    item.completed = item.completed.filter(p => p !== processName);
  }`;

  const newLogic = `  // 不良発生工程を完了から未完了（completed配列から除外）に戻す
  if (Array.isArray(item.completed)) {
    item.completed = item.completed.filter(p => p !== processName);
  }
  
  // 枝番（サブアイテム）の自動生成
  const recreateCheckbox = document.getElementById('defect-reg-recreate');
  if (recreateCheckbox && recreateCheckbox.checked) {
      const maxItemId = Math.max(0, ...order.items.map(i => i.id));
      const newItemId = maxItemId + 1;
      
      const match = item.bomName.match(/\\(再(\\d*)\\)$/);
      let retryCount = 1;
      let newBomName = \`\${item.bomName} (再)\`;
      
      if (match) {
          retryCount = (parseInt(match[1]) || 1) + 1;
          newBomName = item.bomName.replace(/\\(再\\d*\\)$/, \`(再\${retryCount})\`);
      }
      
      const newItem = {
          id: newItemId,
          bomName: newBomName,
          partCode: item.partCode ? \`\${item.partCode}-R\${retryCount}\` : \`R\${retryCount}\`,
          processes: Array.isArray(item.processes) ? [...item.processes] : [],
          completed: [] 
      };
      
      order.items.push(newItem);
  }`;

  if (!code.includes('recreateCheckbox.checked')) {
      code = code.replace(oldLogic, newLogic);
  }

  fs.writeFileSync(filename, code);
}

patchJs('app.js');
patchJs('app-mobile.js');
console.log('JS updated');
