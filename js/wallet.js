/* =============================================
   My Portfolio v5.3.2 — EVM Wallet Integration
   Planner-Creator-Evaluator Cycle 2
   ============================================= */

let isWalletScanning = false;
let walletScanResults = [];

async function rpcCall(rpcUrl, method, params = []) {
  const response = await fetchWithTimeout(rpcUrl, API_TIMEOUT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'RPC error');
  return data.result;
}

async function getNativeBalance(chain, address) {
  try {
    const result = await rpcCall(chain.rpc, 'eth_getBalance', [address, 'latest']);
    if (!result) return 0;
    return Number(BigInt(result)) / 1e18;
  } catch (e) {
    console.warn(`Native balance error on ${chain.name}:`, e.message);
    return 0;
  }
}

async function getTokenBalance(chain, address, tokenAddr, decimals) {
  try {
    const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
    const result = await rpcCall(chain.rpc, 'eth_call', [{ to: tokenAddr, data }, 'latest']);
    if (!result || result === '0x') return 0;
    return Number(BigInt(result)) / (10 ** decimals);
  } catch (e) {
    console.warn(`Token balance error (${tokenAddr} on ${chain.name}):`, e.message);
    return 0;
  }
}

function isValidEvmAddress(addr) {
  return typeof addr === 'string' && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

async function scanWallet(address, onProgress) {
  if (isWalletScanning) return [];
  if (!isValidEvmAddress(address)) {
    showToast('올바른 EVM 주소를 입력하세요 (0x...)', 'error');
    return [];
  }

  isWalletScanning = true;
  walletScanResults = [];
  const results = [];
  const totalSteps = EVM_CHAINS.length * (1 + EVM_TOKENS.length);
  let done = 0;

  for (const chain of EVM_CHAINS) {
    try {
      const nativeBal = await getNativeBalance(chain, address);
      if (nativeBal > 0.0001) {
        results.push({
          chain: chain.id, chainName: chain.name, symbol: chain.sym,
          coinId: chain.coinId, balance: nativeBal, isNative: true, decimals: 18,
        });
      }
    } catch (e) {
      console.warn(`scanWallet native balance failed on ${chain.name}:`, e.message);
    }
    done++;
    onProgress?.({ done, total: totalSteps });

    for (const token of EVM_TOKENS) {
      const tokenAddr = token.addr[chain.id];
      if (!tokenAddr) { done++; onProgress?.({ done, total: totalSteps }); continue; }
      try {
        const bal = await getTokenBalance(chain, address, tokenAddr, token.decimals);
        if (bal > 0.01) {
          results.push({
            chain: chain.id, chainName: chain.name, symbol: token.symbol,
            coinId: token.coinId, balance: bal, isNative: false, decimals: token.decimals,
          });
        }
      } catch (e) {
        console.warn(`scanWallet token ${token.symbol} on ${chain.name} failed:`, e.message);
      }
      done++;
      onProgress?.({ done, total: totalSteps });
    }
  }

  const coinIds = [...new Set(results.map(r => r.coinId))];
  if (coinIds.length > 0) {
    try {
      const prices = await fetchCoinPrices(coinIds);
      for (const r of results) {
        r.priceKRW = safeNum(prices[r.coinId]);
        r.valueKRW = r.balance * r.priceKRW;
      }
    } catch (e) {
      console.warn('scanWallet: failed to fetch prices for wallet assets:', e.message);
      for (const r of results) { r.priceKRW = 0; r.valueKRW = 0; }
    }
  }

  const merged = [];
  const seen = new Map();
  for (const r of results) {
    if (seen.has(r.coinId)) {
      const existing = seen.get(r.coinId);
      existing.balance += r.balance;
      existing.valueKRW += r.valueKRW;
      existing.chains.push(r.chainName);
    } else {
      const entry = { ...r, chains: [r.chainName] };
      seen.set(r.coinId, entry);
      merged.push(entry);
    }
  }
  merged.sort((a, b) => b.valueKRW - a.valueKRW);

  walletScanResults = merged;
  isWalletScanning = false;
  return merged;
}

function importWalletAssets(selectedResults) {
  let imported = 0;
  for (const r of selectedResults) {
    const existing = appState.assets.find(
      a => a.category === '코인' && (a.coinId === r.coinId || a.walletCoinId === r.coinId)
    );
    if (existing) {
      const updatedTxns = [...existing.txns];
      const walletTxnIdx = updatedTxns.findIndex(t => t.memo === '지갑 잔액');
      if (walletTxnIdx >= 0) {
        updatedTxns[walletTxnIdx] = { ...updatedTxns[walletTxnIdx], qty: r.balance, price: r.priceKRW, date: today() };
      } else {
        updatedTxns.push(sanitizeTxn({
          type: 'buy', price: r.priceKRW, qty: r.balance,
          account: r.chains.join(', '), date: today(), memo: '지갑 잔액',
        }));
      }
      updateAsset(existing.id, {
        amount: r.priceKRW, walletCoinId: r.coinId,
        lpu: new Date().toLocaleString('ko-KR'), txns: updatedTxns,
      });
    } else {
      const symbol = COIN_SYM[r.coinId] || r.symbol;
      addAsset({
        name: symbol, category: '코인', amount: r.priceKRW,
        coinId: r.coinId, walletCoinId: r.coinId,
        txns: [{ type: 'buy', price: r.priceKRW, qty: r.balance,
          account: r.chains.join(', '), date: today(), memo: '지갑 잔액' }],
      });
    }
    imported++;
  }
  return imported;
}

function saveWalletAddr(addr) {
  try {
    if (addr && isValidEvmAddress(addr)) localStorage.setItem(WALLET_KEY, addr);
    else localStorage.removeItem(WALLET_KEY);
  } catch (e) {
    console.warn('saveWalletAddr failed:', e);
  }
}

function loadWalletAddr() {
  try { return localStorage.getItem(WALLET_KEY) || ''; } catch (e) {
    console.warn('loadWalletAddr failed:', e);
    return '';
  }
}
