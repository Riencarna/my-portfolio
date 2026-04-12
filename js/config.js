/* =============================================
   My Portfolio v5.4.2 — Configuration
   Soft Neutral palette, Planner-Creator-Evaluator Cycle 3
   ============================================= */

const APP_VERSION = '5.4.2';
const APP_NAME = 'My Portfolio';

// ── Timing Constants ──
const MODAL_ANIM_MS = 200;
const TOAST_DURATION_MS = 2500;
const TOAST_FADE_MS = 300;
const DEBOUNCE_MS = 300;
const SAVE_DEBOUNCE_MS = 2000;
const SPLASH_FADE_MS = 400;
const CACHE_TTL_RATE = 600_000;
const CACHE_TTL_BENCH = 3_600_000;
const API_TIMEOUT = 8000;
const STOCK_DELAY_MS = 300;
const RETRY_DELAY_MS = 2000;
const PDF_PRINT_DELAY_MS = 500;
const PAGE_ENTER_MS = 400;
const DYNAMIC_COLOR_DELAY_MS = 50;

// ── Swipe Navigation ──
const SWIPE_THRESHOLD_PX = 60;

// ── Chart Rendering ──
const CHART_POINT_THRESHOLD = 60;

// ── Touch Drag Ghost Offset ──
const TOUCH_GHOST_OFFSET = Object.freeze({ x: 30, y: 20 });

// ── Analysis Thresholds ──
const ANALYSIS_THRESHOLDS = Object.freeze({
  safeLow: 10,
  cryptoHigh: 30,
  foreignLow: 20,
  domesticHigh: 30,
  domesticRisk: 80,
  singleAssetMax: 50,
  bigLoss: -30,
});

// Lazy-render threshold
const LAZY_RENDER_THRESHOLD = 20;
const LAZY_RENDER_PAGE = 20;

// History pagination
const HISTORY_PAGE_SIZE = 50;

// Focusable element selector (WCAG)
const FOCUSABLE_SEL = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), a[href]';

// Storage keys
const STORAGE_KEY = 'myportfolio_v9';
const META_KEY = 'mp_portfolio_meta';
const THEME_KEY = 'mp_theme';
const TAB_KEY = 'mp_last_tab';
const RATE_KEY = 'mp_ex_rate';
const WALLET_KEY = 'wl_addr';
const CUSTOM_PROXY_KEY = 'mp_custom_proxy';

// Limits
const LIMITS = Object.freeze({
  assets: 500,
  txns: 5000,
  history: 3650,
  portfolios: 10,
  storage: 4_500_000,
  upload: 10_485_760,
  logs: 200,
});

// Fallback values
const FALLBACK_USD_KRW = 1350;

// Asset categories — Soft Neutral palette (v5.0.0)
const CATEGORIES = Object.freeze([
  { id: '국내주식', icon: '🇰🇷', color: '#7C6FF0', label: '국내주식' },
  { id: '해외주식', icon: '🌍', color: '#A395F5', label: '해외주식' },
  { id: '코인',     icon: '₿',  color: '#E8B474', label: '코인' },
  { id: '현금',     icon: '💵', color: '#6BBF8A', label: '현금' },
  { id: '예적금',   icon: '🏦', color: '#6B9DC7', label: '예적금' },
  { id: '부동산',   icon: '🏠', color: '#E8889E', label: '부동산' },
  { id: '기타',     icon: '📦', color: '#B5ADA0', label: '기타' },
]);
const CAT_MAP = Object.freeze(Object.fromEntries(CATEGORIES.map(c => [c.id, c])));
const CAT_IDS = Object.freeze(CATEGORIES.map(c => c.id));
const INVESTMENT_CATS = Object.freeze(['국내주식', '해외주식', '코인']);

// USDT location presets (exchange/wallet/DeFi/domestic)
const USDT_LOCATIONS = Object.freeze({
  overseas: {
    label: '해외 CEX',
    icon: '🌐',
    items: ['Binance', 'BYBIT', 'Bitget', 'Gate.io', 'Flipster', 'OKX'],
  },
  wallet: {
    label: '지갑',
    icon: '👛',
    items: ['OKX wallet', 'Rabby wallet'],
  },
  defi: {
    label: 'DeFi',
    icon: '🔗',
    items: [],
  },
  domestic: {
    label: '국내 CEX',
    icon: '🇰🇷',
    items: ['빗썸', '업비트', '코빗', '코인원', '고팍스'],
  },
});

// Income categories
const INCOME_CATS = Object.freeze([
  { id: 'salary',   label: '급여',       icon: '💰' },
  { id: 'bonus',    label: '상여금',     icon: '🎁' },
  { id: 'side',     label: '부업',       icon: '💼' },
  { id: 'invest',   label: '투자수익',   icon: '📈' },
  { id: 'rental',   label: '임대수입',   icon: '🏠' },
  { id: 'interest', label: '이자/배당',  icon: '🏦' },
  { id: 'other',    label: '기타',       icon: '📦' },
]);
const INCOME_MAP = Object.freeze(Object.fromEntries(INCOME_CATS.map(c => [c.id, c])));

// CoinGecko ID mapping
const COIN_IDS = Object.freeze({
  BTC:'bitcoin', ETH:'ethereum', SOL:'solana', XRP:'ripple',
  BNB:'binancecoin', HYPE:'hyperliquid',
  DOGE:'dogecoin', ADA:'cardano', AVAX:'avalanche-2', DOT:'polkadot',
  MATIC:'matic-network', LINK:'chainlink', UNI:'uniswap', ATOM:'cosmos',
  FIL:'filecoin', APT:'aptos', ARB:'arbitrum', OP:'optimism',
  SUI:'sui', SEI:'sei-network', TIA:'celestia', INJ:'injective-protocol',
  NEAR:'near', STX:'blockstack', AAVE:'aave', ENA:'ethena',
  PEPE:'pepe', SHIB:'shiba-inu', WIF:'dogwifcoin', BONK:'bonk',
  FLOKI:'floki', ONDO:'ondo-finance', RENDER:'render-token',
  FET:'fetch-ai', TAO:'bittensor', SAND:'the-sandbox',
  MANA:'decentraland', AXS:'axie-infinity', IMX:'immutable-x',
  GALA:'gala', HBAR:'hedera-hashgraph', ALGO:'algorand',
  VET:'vechain', EOS:'eos', XLM:'stellar', TRX:'tron',
  TON:'the-open-network', USDT:'tether', USDC:'usd-coin',
});
const COIN_SYM = Object.freeze(
  Object.fromEntries(Object.entries(COIN_IDS).map(([s, id]) => [id, s]))
);

// KRX ETF name prefixes
const ETF_PREFIXES = Object.freeze([
  'KODEX','TIGER','KBSTAR','SOL','ARIRANG','HANARO','KOSEF','ACE','TIMEFOLIO','PLUS'
]);

// EVM chains
const EVM_CHAINS = Object.freeze([
  { id:'ethereum',  name:'Ethereum',        sym:'ETH',  rpc:'https://ethereum-rpc.publicnode.com',   coinId:'ethereum' },
  { id:'bsc',       name:'BNB Smart Chain',  sym:'BNB',  rpc:'https://bsc-dataseed.binance.org',      coinId:'binancecoin' },
  { id:'polygon',   name:'Polygon',         sym:'POL',  rpc:'https://polygon-rpc.com',               coinId:'matic-network' },
  { id:'arbitrum',  name:'Arbitrum',        sym:'ETH',  rpc:'https://arb1.arbitrum.io/rpc',          coinId:'ethereum' },
  { id:'optimism',  name:'Optimism',        sym:'ETH',  rpc:'https://mainnet.optimism.io',           coinId:'ethereum' },
  { id:'avalanche', name:'Avalanche',       sym:'AVAX', rpc:'https://api.avax.network/ext/bc/C/rpc', coinId:'avalanche-2' },
]);

// ERC-20 tokens
const EVM_TOKENS = Object.freeze([
  { symbol:'USDT', coinId:'tether', decimals:6, addr:{
    ethereum:'0xdAC17F958D2ee523a2206206994597C13D831ec7', bsc:'0x55d398326f99059fF775485246999027B3197955',
    polygon:'0xc2132D05D31c914a87C6611C10748AEb04B58e8F', arbitrum:'0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    optimism:'0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', avalanche:'0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
  }},
  { symbol:'USDC', coinId:'usd-coin', decimals:6, addr:{
    ethereum:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', bsc:'0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    polygon:'0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', arbitrum:'0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    optimism:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', avalanche:'0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  }},
  { symbol:'DAI', coinId:'dai', decimals:18, addr:{
    ethereum:'0x6B175474E89094C44Da98b954EedeAC495271d0F', polygon:'0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    arbitrum:'0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', optimism:'0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  }},
  { symbol:'WBTC', coinId:'wrapped-bitcoin', decimals:8, addr:{
    ethereum:'0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', polygon:'0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    arbitrum:'0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  }},
  { symbol:'LINK', coinId:'chainlink', decimals:18, addr:{
    ethereum:'0x514910771AF9Ca656af840dff83E8264EcF986CA', bsc:'0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD',
    polygon:'0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', arbitrum:'0xf97f4df75117a78c1A5a0DBb814Af92458539FB4',
    avalanche:'0x5947BB275c521040051D82396192181b413227A3',
  }},
  { symbol:'UNI', coinId:'uniswap', decimals:18, addr:{
    ethereum:'0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', polygon:'0xb33EaAd8d922B1083446DC23f610c2567fB5180f',
    arbitrum:'0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0', optimism:'0x6fd9d7AD17242c41f7131d257212c54A0e816691',
  }},
  { symbol:'AAVE', coinId:'aave', decimals:18, addr:{
    ethereum:'0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', polygon:'0xD6DF932A45C0f255f85145f286eA0b292B21C90B',
    avalanche:'0x63a72806098Bd3D9520cC43356dD78afe5D386D9',
  }},
]);

// CORS proxies
const CORS_PROXIES = [
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  u => `https://corsproxy.org/?${encodeURIComponent(u)}`,
];

// API endpoints
const API = Object.freeze({
  coingecko:   'https://api.coingecko.com/api/v3',
  yahoo:       'https://query1.finance.yahoo.com',
  naver:       'https://m.stock.naver.com/api/stock',
  naverWorld:  'https://api.stock.naver.com/stock',
  stooq:       'https://stooq.com/q/l/',
  openER:      'https://open.er-api.com/v6/latest/USD',
  floatRates:  'https://www.floatrates.com/daily/usd.json',
  upbit:       'https://api.upbit.com/v1/ticker',
  bithumb:     'https://api.bithumb.com/public/ticker',
});

// Benchmark indices
const BENCHMARKS = Object.freeze({ kospi: '^KS11', sp500: '^GSPC' });

// ── Simple Event Bus ──
const EventBus = {
  _handlers: {},
  on(event, fn) {
    (this._handlers[event] = this._handlers[event] || []).push(fn);
  },
  off(event, fn) {
    if (!this._handlers[event]) return;
    this._handlers[event] = this._handlers[event].filter(h => h !== fn);
  },
  once(event, fn) {
    const wrapper = (data) => { this.off(event, wrapper); fn(data); };
    this.on(event, wrapper);
  },
  emit(event, data) {
    (this._handlers[event] || []).forEach(fn => {
      try { fn(data); } catch (e) { console.error(`EventBus [${event}]:`, e); }
    });
  },
};

// ── Centralized UI State ──
const UIState = {
  listCategoryOpen: {},
  listCategoryShown: {},
  dashboardCategoryOpen: {},
  dashboardTrendDays: 30,
  isEditMode: false,
  listSearchQuery: '',
  historyFilter: 30,
  historyShown: HISTORY_PAGE_SIZE,
  incomeMonth: (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  })(),

  reset() {
    this.listCategoryOpen = {};
    this.listCategoryShown = {};
    this.dashboardCategoryOpen = {};
    this.dashboardTrendDays = 30;
    this.isEditMode = false;
    this.listSearchQuery = '';
    this.historyFilter = 30;
    this.historyShown = HISTORY_PAGE_SIZE;
  },
};
