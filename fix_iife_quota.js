const fs = require('fs');

function patchFile(filename) {
  if (!fs.existsSync(filename)) return;
  let code = fs.readFileSync(filename, 'utf8');
  
  const oldIIFE = `
    if (healed) {
      console.log('Saved fully healed monthly data.');
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
    }
  } catch(e) {
    console.error('Heal monthly failed', e);
  }
})();
  `;
  
  const newIIFE = `
    if (healed) {
      console.log('Saved fully healed monthly data.');
      DB.save(DB.KEYS.INV_MONTHLY, monthly);
    }

    // 4. 清掃作業：すでに確定済みの月の tempScans を削除して容量オーバー(QuotaExceededError)を防ぐ
    const tempScans = DB.getTempScans() || [];
    const closedMonths = new Set(monthly.map(m => m.month));
    const initialTempScansCount = tempScans.length;
    const cleanedTempScans = tempScans.filter(s => !closedMonths.has(s.month));
    if (cleanedTempScans.length !== initialTempScansCount) {
        console.log(\`Cleaned up \${initialTempScansCount - cleanedTempScans.length} old temp scans.\`);
        DB.save(DB.KEYS.INV_SCAN_TEMP, cleanedTempScans);
    }

  } catch(e) {
    console.error('Heal monthly failed', e);
  }
})();
  `;
  
  code = code.replace(oldIIFE, newIIFE);
  fs.writeFileSync(filename, code);
}

patchFile('app.js');
patchFile('app-mobile.js');
console.log('IIFE quota cleaner applied');
