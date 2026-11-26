import type { DatasetSummary } from '../shared/types.ts';

export interface SampleDatasetDef {
  id: string;
  title: string;
  filename: string;
  description: string;
  rowCountLabel: string;
  csvText: string;
}

function buildSaasLedgerCsv(): string {
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America'];
  const plans = [
    { name: 'Starter', baseMrr: 149, seatsMin: 2, seatsMax: 8 },
    { name: 'Growth', baseMrr: 590, seatsMin: 8, seatsMax: 30 },
    { name: 'Enterprise', baseMrr: 2400, seatsMin: 35, seatsMax: 180 },
  ];
  const industries = ['Fintech', 'Logistics', 'Healthcare', 'Retail', 'Developer Tools', 'Media'];
  const risks = ['Low', 'Low', 'Low', 'Medium', 'Medium', 'High'];
  const prefixes = [
    'Northstar', 'Vanguard', 'Meridian', 'Alder', 'Beacon', 'Clearwater',
    'Driftwood', 'Evergreen', 'Foundry', 'Granite', 'Harbor', 'Ironclad',
    'Juniper', 'Keystone', 'Lattice', 'Monarch', 'Noble', 'Oakridge',
  ];
  const suffixes = ['Systems', 'Health', 'Freight', 'Labs', 'Commerce', 'Works', 'Group', 'Analytics'];

  const lines = ['Account,Plan,Region,Industry,SignupDate,MRR,Seats,NRR_Percent,ChurnRisk'];
  for (let i = 0; i < 180; i++) {
    const plan = plans[(i * 7 + 3) % 10 < 4 ? 0 : (i * 7 + 3) % 10 < 8 ? 1 : 2];
    const region = regions[(i * 3 + Math.floor(i / 7)) % regions.length];
    const industry = industries[(i * 5 + 1) % industries.length];
    const month = ((i * 5) % 12) + 1;
    const day = ((i * 11) % 28) + 1;
    const year = i < 60 ? 2025 : 2026;
    const signupDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const seats = plan.seatsMin + ((i * 13) % (plan.seatsMax - plan.seatsMin + 1));
    const mrrJitter = ((i * 47) % 9) * 35;
    const mrr = plan.baseMrr + seats * 18 + mrrJitter;
    const risk = risks[(i * 11 + (region === 'Latin America' ? 2 : 0)) % risks.length];
    const nrrBase = risk === 'High' ? 88 : risk === 'Medium' ? 103 : 116;
    const nrr = nrrBase + ((i * 7) % 15) - 4;
    const account = `${prefixes[i % prefixes.length]} ${suffixes[(i * 3) % suffixes.length]} ${100 + i}`;
    lines.push(
      `"${account}",${plan.name},${region},${industry},${signupDate},$${mrr},${seats},${nrr}%,${risk}`
    );
  }
  return lines.join('\n');
}

function buildRetailOrdersCsv(): string {
  const regions = ['West', 'Northeast', 'Midwest', 'South', 'Central'];
  const channels = ['Direct Web', 'Partner Retail', 'Marketplace', 'B2B Portal'];
  const catalog = [
    { category: 'Monitors', product: '27" 4K Reference Display', price: 640 },
    { category: 'Monitors', product: '34" Ultrawide Studio Panel', price: 890 },
    { category: 'Peripherals', product: 'Mechanical Tactile Keyboard', price: 165 },
    { category: 'Peripherals', product: 'Precision Wireless Mouse', price: 95 },
    { category: 'Audio', product: 'Studio Reference Headphones', price: 290 },
    { category: 'Audio', product: 'USB Condenser Microphone', price: 185 },
    { category: 'Furniture', product: 'Standing Desk Frame Pro', price: 540 },
    { category: 'Furniture', product: 'Ergonomic Task Chair', price: 720 },
  ];

  const lines = ['OrderID,OrderDate,Region,Channel,Category,Product,Units,UnitPrice,DiscountPct,Revenue'];
  for (let i = 0; i < 220; i++) {
    const item = catalog[(i * 5 + Math.floor(i / 11)) % catalog.length];
    const region = regions[(i * 3 + Math.floor(i / 13)) % regions.length];
    const channel = channels[(i * 7 + 2) % channels.length];
    const month = ((i * 3) % 11) + 1;
    const day = ((i * 9) % 28) + 1;
    const orderDate = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const units = 1 + ((i * 7) % 6);
    const discount = [0, 0, 5, 10, 15][(i * 3) % 5];
    const revenue = Number((units * item.price * (1 - discount / 100)).toFixed(2));
    const orderId = `ORD-${String(4100 + i)}`;
    lines.push(
      `${orderId},${orderDate},${region},${channel},${item.category},"${item.product}",${units},$${item.price},${discount}%,$${revenue.toFixed(2)}`
    );
  }
  return lines.join('\n');
}

function buildGridTelemetryCsv(): string {
  const facilities = [
    { name: 'Mojave Solar Array', source: 'Solar PV', cap: 320 },
    { name: 'Columbia Wind Ridge', source: 'Onshore Wind', cap: 240 },
    { name: 'Cascade Hydro Station', source: 'Hydroelectric', cap: 410 },
    { name: 'Baja Storage Hub', source: 'Battery Grid', cap: 150 },
  ];

  const lines = ['Date,Facility,Source,CapacityMW,GenerationMWh,EfficiencyPct,DowntimeHours,SpotPriceUSD'];
  const start = Date.UTC(2026, 5, 1);
  for (let d = 0; d < 36; d++) {
    const dt = new Date(start + d * 86400000);
    const dateStr = dt.toISOString().slice(0, 10);
    for (let f = 0; f < facilities.length; f++) {
      const fac = facilities[f];
      const wave = Math.sin((d + f * 3) * 0.45);
      const eff = Number((74 + wave * 12 + (f === 2 ? 9 : 0)).toFixed(1));
      const gen = Number((fac.cap * 24 * (eff / 100) * 0.72).toFixed(1));
      const downtime = (d + f) % 9 === 0 ? Number((((d + f) % 4) + 0.5).toFixed(1)) : 0;
      const price = Number((38 + Math.cos(d * 0.35 + f) * 14 + (f === 3 ? 11 : 0)).toFixed(2));
      lines.push(
        `${dateStr},"${fac.name}",${fac.source},${fac.cap},${gen},${eff}%,${downtime},$${price.toFixed(2)}`
      );
    }
  }
  return lines.join('\n');
}

export const SAMPLE_DATASETS: SampleDatasetDef[] = [
  {
    id: 'saas-ledger',
    title: 'SaaS Revenue & Churn Ledger',
    filename: 'saas_revenue_ledger.csv',
    description:
      'B2B customer subscriptions with monthly recurring revenue, seat counts, net retention, and churn risk tiers.',
    rowCountLabel: '180 rows · 9 columns',
    csvText: buildSaasLedgerCsv(),
  },
  {
    id: 'retail-orders',
    title: 'Global Hardware Retail Orders',
    filename: 'retail_orders_2026.csv',
    description:
      '2026 multi-channel sales ledger covering monitors, audio gear, and workspace furniture with unit prices and discounts.',
    rowCountLabel: '220 rows · 10 columns',
    csvText: buildRetailOrdersCsv(),
  },
  {
    id: 'grid-telemetry',
    title: 'Renewable Grid Telemetry',
    filename: 'grid_telemetry_daily.csv',
    description:
      'Daily power generation, efficiency percentages, downtime hours, and spot market pricing across four facilities.',
    rowCountLabel: '144 rows · 8 columns',
    csvText: buildGridTelemetryCsv(),
  },
];

export function generateStarterQuestions(summary: DatasetSummary): string[] {
  const numericCols = summary.columns.filter(
    (c) => c.type === 'number' || c.type === 'currency' || c.type === 'percent'
  );
  const categoryCols = summary.columns.filter(
    (c) => (c.type === 'string' || c.type === 'boolean') && c.uniqueCount > 1 && c.uniqueCount <= 30
  );
  const dateCols = summary.columns.filter((c) => c.type === 'date');

  const suggestions: string[] = [];

  if (numericCols.length > 0 && categoryCols.length > 0) {
    suggestions.push(
      `Break down total and average ${numericCols[0].name} by ${categoryCols[0].name} with a chart.`
    );
  }
  if (dateCols.length > 0 && numericCols.length > 0) {
    suggestions.push(
      `Show the monthly trend of ${numericCols[0].name} over ${dateCols[0].name}.`
    );
  }
  if (numericCols.length >= 2) {
    suggestions.push(
      `What is the correlation between ${numericCols[0].name} and ${numericCols[1].name}?`
    );
  }
  if (categoryCols.length >= 2 && numericCols.length > 0) {
    suggestions.push(
      `Which top 5 combinations of ${categoryCols[0].name} and ${categoryCols[1].name} lead in ${numericCols[0].name}?`
    );
  }
  if (suggestions.length < 3 && numericCols.length > 0) {
    suggestions.push(
      `Show the top 10 rows sorted by highest ${numericCols[0].name}.`
    );
  }
  if (suggestions.length < 3) {
    suggestions.push(
      `Summarize the key distributions, missing values, and standout patterns in ${summary.name}.`
    );
  }

  return suggestions.slice(0, 4);
}
