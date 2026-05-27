import json

INV_CATEGORIES = {
  '01': '基材',
  '02': '面材',
  '03': 'シート',
  '04': '木口ﾃｰﾌﾟ',
  '05': '金具',
  '06': 'ﾀﾞﾝﾎﾞｰﾙ',
  '07': '接着剤',
  '08': '仕入備品',
  '09': 'PAO資材',
  '10': '工場部材',
  '11': '仕掛品芯組のみ',
  '12': '仕掛品カット',
  '13': '部材完成品',
  '14': '製品在庫',
  '15': 'シェルフ製品在庫',
  '16': 'キャビネット製品在庫',
  '17': 'ラミテック',
  '18': '天野木工',
  '19': 'いろは',
  '20': 'Real',
  '21': 'イイダアックス',
  '22': '下請け預かり品',
  '23': 'GRID不動品',
  '24': '仕掛品フラッシュのみ',
  '25': '仕掛品縁貼り',
  '26': '仕掛品ボーリング',
  '99': 'その他'
}

with open('data/new_monthly_1_to_5.json', 'r') as f:
    data = json.load(f)

for m in data:
    for catKey, s in m['summary'].items():
        if catKey == 'fixed':
            s['name'] = '不動品'
        else:
            s['name'] = INV_CATEGORIES.get(catKey, f'分類{catKey}')

with open('data/new_monthly_1_to_5.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated data/new_monthly_1_to_5.json")
