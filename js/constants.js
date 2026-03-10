/* ===================================================
   constants.js - 설정 상수 및 정적 데이터
   =================================================== */

var APP_VERSION = "v2.3.0";
var STORAGE_KEY = "myportfolio_v9";
var QUOTE = "'";

// 카테고리 설정 (아이콘, 색상)
var CATEGORY_CONFIG = {
  "국내주식": { color: "#3B82F6", icon: "📈" },
  "해외주식": { color: "#8B5CF6", icon: "🌎" },
  "코인":     { color: "#F59E0B", icon: "₿" },
  "현금":     { color: "#10B981", icon: "💵" },
  "예적금":   { color: "#06B6D4", icon: "🏦" },
  "부동산":   { color: "#EC4899", icon: "🏠" },
  "기타":     { color: "#A78BFA", icon: "📦" }
};
var CATEGORY_LIST = Object.keys(CATEGORY_CONFIG);

// 코인 이름 → CoinGecko ID 매핑
var COIN_ID_MAP = {
  "비트코인": "bitcoin", "이더리움": "ethereum", "리플": "ripple",
  "솔라나": "solana", "트론": "tron", "수이": "sui",
  "하이퍼리퀴드": "hyperliquid", "바이낸스코인": "binancecoin",
  "테더": "tether", "유에스디씨": "usd-coin", "유에스디원": "usd1-wlfi",
  "btc": "bitcoin", "eth": "ethereum", "xrp": "ripple",
  "sol": "solana", "trx": "tron", "sui": "sui",
  "hype": "hyperliquid", "bnb": "binancecoin",
  "usdt": "tether", "usdc": "usd-coin", "usd1": "usd1-wlfi"
};

// CoinGecko ID → 한국어 이름 매핑
var COIN_KOREAN_NAMES = {
  "bitcoin": "비트코인", "ethereum": "이더리움", "ripple": "리플",
  "solana": "솔라나", "tron": "트론", "sui": "수이",
  "hyperliquid": "하이퍼리퀴드", "binancecoin": "바이낸스코인(BNB)",
  "tether": "USDT", "usd-coin": "USDC", "usd1-wlfi": "USD1"
};

// 인기 코인 목록
var TOP_COIN_IDS = [
  "bitcoin", "ethereum", "ripple", "tron", "solana",
  "sui", "hyperliquid", "binancecoin", "usd-coin", "usd1-wlfi"
];

// 국내 주요 종목
var KR_STOCK_PRESETS = [
  { name: "삼성전자", code: "005930" }, { name: "SK하이닉스", code: "000660" },
  { name: "LG에너지솔루션", code: "373220" }, { name: "현대차", code: "005380" },
  { name: "기아", code: "000270" }, { name: "셀트리온", code: "068270" },
  { name: "KB금융", code: "105560" }, { name: "NAVER", code: "035420" },
  { name: "카카오", code: "035720" }, { name: "삼성SDI", code: "006400" },
  { name: "POSCO홀딩스", code: "005490" }, { name: "현대모비스", code: "012330" },
  { name: "KODEX 200", code: "069500" }, { name: "KODEX 반도체", code: "091160" },
  { name: "KODEX 2차전지", code: "305720" }, { name: "TIGER 반도체", code: "091230" },
  { name: "SOL 조선TOP3플러스", code: "466920" }, { name: "KODEX 자동차", code: "091170" }
];

// 국내 상장 해외 ETF
var KR_FOREIGN_ETF_PRESETS = [
  { name: "TIGER 미국S&P500", code: "360750" }, { name: "KODEX 미국S&P500", code: "379800" },
  { name: "ACE 미국S&P500", code: "360200" }, { name: "RISE 미국S&P500", code: "379780" },
  { name: "SOL 미국S&P500", code: "433330" }, { name: "KODEX 미국나스닥100", code: "379810" },
  { name: "TIGER 미국나스닥100", code: "133690" }, { name: "ACE 미국나스닥100", code: "368590" },
  { name: "TIGER 미국배당다우존스", code: "458730" }, { name: "KODEX 미국배당다우존스", code: "489250" },
  { name: "ACE 미국배당다우존스", code: "402970" }, { name: "SOL 미국배당다우존스", code: "446720" },
  { name: "KODEX 미국반도체MV", code: "390390" }, { name: "ACE 미국빅테크TOP7 Plus", code: "465580" },
  { name: "TIGER 미국필라델피아AI반도체나스닥", code: "381180" },
  { name: "KODEX 미국AI전력핵심인프라", code: "495090" },
  { name: "ACE 글로벌반도체TOP4 Plus SOLACTIVE", code: "448540" },
  { name: "TIGER 차이나항셍테크", code: "371460" },
  { name: "TIGER 인도니프티50", code: "236350" }, { name: "KODEX 인도Nifty50", code: "453810" },
  { name: "TIGER 일본니케이225", code: "241180" }, { name: "KODEX 미국서학개미", code: "473460" },
  { name: "TIGER 글로벌혁신블루칩TOP10", code: "469150" },
  { name: "ACE 테슬라밸류체인액티브", code: "456250" }
];

// 수입 카테고리
var INCOME_CATEGORIES = [
  { id: "salary",   label: "💼 월급",          color: "#3B82F6" },
  { id: "bonus",    label: "🎉 보너스/상여",    color: "#F59E0B" },
  { id: "side",     label: "💻 부업/프리랜서",   color: "#8B5CF6" },
  { id: "invest",   label: "📈 투자 수익",      color: "#10B981" },
  { id: "rental",   label: "🏠 임대 수입",      color: "#EC4899" },
  { id: "interest", label: "🏦 이자/배당",      color: "#06B6D4" },
  { id: "etc",      label: "📦 기타",          color: "#A78BFA" }
];

// CORS 프록시 목록
var CORS_PROXIES = [
  function(u) { return "https://corsproxy.io/?url=" + encodeURIComponent(u); },
  function(u) { return "https://api.allorigins.win/raw?url=" + encodeURIComponent(u); },
  function(u) { return "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u); },
  function(u) { return "https://corsproxy.org/?url=" + encodeURIComponent(u); }
];

// 카테고리 파이 차트 색상
var CATEGORY_PIE_COLORS = [
  "#60A5FA", "#A78BFA", "#F472B6", "#34D399", "#FBBF24", "#FB923C",
  "#38BDF8", "#E879F9", "#818CF8", "#4ADE80", "#FB7185", "#22D3EE"
];

// EVM 체인 설정
var EVM_CHAINS = [
  { id: "eth", name: "Ethereum", symbol: "ETH", icon: "⟠",
    rpc: "https://ethereum-rpc.publicnode.com", decimals: 18,
    coingeckoId: "ethereum", explorer: "https://etherscan.io/address/" },
  { id: "bsc", name: "BNB Chain", symbol: "BNB", icon: "🔶",
    rpc: "https://bsc-dataseed.binance.org", decimals: 18,
    coingeckoId: "binancecoin", explorer: "https://bscscan.com/address/" },
  { id: "polygon", name: "Polygon", symbol: "POL", icon: "🟣",
    rpc: "https://polygon-rpc.com", decimals: 18,
    coingeckoId: "matic-network", explorer: "https://polygonscan.com/address/" },
  { id: "arb", name: "Arbitrum", symbol: "ETH", icon: "🔵",
    rpc: "https://arb1.arbitrum.io/rpc", decimals: 18,
    coingeckoId: "ethereum", explorer: "https://arbiscan.io/address/" },
  { id: "op", name: "Optimism", symbol: "ETH", icon: "🔴",
    rpc: "https://mainnet.optimism.io", decimals: 18,
    coingeckoId: "ethereum", explorer: "https://optimistic.etherscan.io/address/" },
  { id: "avax", name: "Avalanche", symbol: "AVAX", icon: "🔺",
    rpc: "https://api.avax.network/ext/bc/C/rpc", decimals: 18,
    coingeckoId: "avalanche-2", explorer: "https://snowtrace.io/address/" }
];

// EVM 토큰 설정
var EVM_TOKENS = [
  { symbol: "USDT", name: "Tether", coingeckoId: "tether", decimals: 6,
    contracts: { eth: "0xdAC17F958D2ee523a2206206994597C13D831ec7", bsc: "0x55d398326f99059fF775485246999027B3197955", polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", arb: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", op: "0x94b008aA00579c1307B0EF2c499aD98a8cE58e58", avax: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7" } },
  { symbol: "USDC", name: "USD Coin", coingeckoId: "usd-coin", decimals: 6,
    contracts: { eth: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", arb: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", op: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", avax: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" } },
  { symbol: "DAI", name: "Dai", coingeckoId: "dai", decimals: 18,
    contracts: { eth: "0x6B175474E89094C44Da98b954EedeAC495271d0F", polygon: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" } },
  { symbol: "WBTC", name: "Wrapped BTC", coingeckoId: "wrapped-bitcoin", decimals: 8,
    contracts: { eth: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", polygon: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", arb: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" } },
  { symbol: "LINK", name: "Chainlink", coingeckoId: "chainlink", decimals: 18,
    contracts: { eth: "0x514910771AF9Ca656af840dff83E8264EcF986CA", bsc: "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", polygon: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39" } },
  { symbol: "UNI", name: "Uniswap", coingeckoId: "uniswap", decimals: 18,
    contracts: { eth: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", polygon: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f" } },
  { symbol: "AAVE", name: "Aave", coingeckoId: "aave", decimals: 18,
    contracts: { eth: "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", polygon: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B" } }
];
