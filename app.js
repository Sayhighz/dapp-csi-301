(() => {
  "use strict";

  const { ethers } = window;
  const config = window.APP_CONFIG;

  // Matches contracts/Bank.sol.
  const BANK_ABI = [
    "event Deposit(address indexed owner, uint256 amount)",
    "event Withdraw(address indexed owner, uint256 amount)",
    "function deposit() payable",
    "function withdraw(uint256 amount)",
    "function checkBlance() view returns (uint256 balance)",
  ];
  const STORAGE_KEY = "bank-dapp:contract-address";

  const el = {
    studentId: document.getElementById("student-id"),
    studentName: document.getElementById("student-name"),
    connectBtn: document.getElementById("connect-btn"),
    account: document.getElementById("account"),
    network: document.getElementById("network"),
    walletBalance: document.getElementById("wallet-balance"),
    contractForm: document.getElementById("contract-form"),
    contractAddress: document.getElementById("contract-address"),
    contractBtn: document.getElementById("contract-btn"),
    bankCard: document.getElementById("bank-card"),
    bankBalance: document.getElementById("bank-balance"),
    checkBtn: document.getElementById("check-btn"),
    txForm: document.getElementById("tx-form"),
    amount: document.getElementById("amount"),
    depositBtn: document.getElementById("deposit-btn"),
    withdrawBtn: document.getElementById("withdraw-btn"),
    feedback: document.getElementById("feedback"),
  };

  const state = {
    provider: null,
    signer: null,
    account: null,
    contract: null,
    busy: false,
  };

  function readStoredAddress() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  function storeAddress(address) {
    try {
      localStorage.setItem(STORAGE_KEY, address);
    } catch {
      // Storage unavailable (private mode); address still works for this session.
    }
  }

  function log(message, kind = "info") {
    const item = document.createElement("li");
    item.className = kind;
    const time = document.createElement("time");
    time.textContent = new Date().toLocaleTimeString();
    item.append(time, document.createTextNode(message));
    el.feedback.prepend(item);
  }

  function errorMessage(err) {
    if (err?.code === "ACTION_REJECTED" || err?.code === 4001) {
      return "ผู้ใช้ยกเลิกรายการใน MetaMask";
    }
    // MetaMask wraps node errors, so ethers reports a bare "missing revert data";
    // surface the node's own message (e.g. insufficient funds) instead.
    const nodeError = err?.info?.error;
    if (err?.code === "CALL_EXCEPTION" && !err.reason && nodeError) {
      return nodeError.data?.message || nodeError.message || err.shortMessage;
    }
    return err?.reason || err?.shortMessage || err?.message || String(err);
  }

  function render() {
    const walletReady = Boolean(state.signer);
    const contractReady = Boolean(state.contract);
    const actionsEnabled = contractReady && !state.busy;

    el.connectBtn.textContent = walletReady ? "Connected" : "Connect Wallet";
    el.connectBtn.disabled = walletReady || state.busy;
    el.contractBtn.disabled = !walletReady || state.busy;
    el.bankCard.setAttribute("aria-disabled", String(!contractReady));
    for (const control of [el.checkBtn, el.amount, el.depositBtn, el.withdrawBtn]) {
      control.disabled = !actionsEnabled;
    }
  }

  function resetWallet() {
    state.provider = null;
    state.signer = null;
    state.account = null;
    state.contract = null;
    el.account.textContent = "Not connected";
    el.network.textContent = "-";
    el.walletBalance.textContent = "-";
    el.bankBalance.textContent = "0";
    render();
  }

  // Serializes user actions so only one wallet request runs at a time.
  async function run(action) {
    if (state.busy) return;
    state.busy = true;
    render();
    try {
      await action();
    } catch (err) {
      console.error(err);
      log(errorMessage(err), "err");
    } finally {
      state.busy = false;
      render();
    }
  }

  function requireMetaMask() {
    if (!window.ethereum) {
      throw new Error("ไม่พบ MetaMask กรุณาติดตั้ง MetaMask extension แล้วรีเฟรชหน้าเว็บ");
    }
    return window.ethereum;
  }

  // On success MetaMask emits chainChanged, which reloads the page and reconnects.
  async function switchNetwork(ethereum) {
    const { chainId, name } = config.network;
    log(`MetaMask อยู่ผิด network กำลังขอเปลี่ยนเป็น ${name}...`, "pending");
    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ethers.toBeHex(chainId) }],
      });
    } catch (err) {
      console.error(err);
      throw new Error(`กรุณาเปลี่ยน network ใน MetaMask เป็น ${name} (Chain ID ${chainId})`);
    }
  }

  async function connectWallet() {
    const ethereum = requireMetaMask();
    await ethereum.request({ method: "eth_requestAccounts" });
    const provider = new ethers.BrowserProvider(ethereum);
    const network = await provider.getNetwork();
    if (network.chainId !== BigInt(config.network.chainId)) {
      await switchNetwork(ethereum);
      return;
    }

    state.provider = provider;
    state.signer = await state.provider.getSigner();
    state.account = await state.signer.getAddress();

    const chainId = network.chainId.toString();
    el.account.textContent = state.account;
    el.network.textContent = network.name === "unknown" ? `Chain ID ${chainId}` : `${network.name} (${chainId})`;
    log(`เชื่อมต่อ MetaMask สำเร็จ: ${state.account}`, "ok");
    await refreshWalletBalance();

    if (el.contractAddress.value.trim()) {
      await connectContract();
    }
  }

  async function connectContract() {
    if (!state.signer) throw new Error("กรุณา Connect Wallet ก่อน");
    const address = el.contractAddress.value.trim();
    if (!ethers.isAddress(address)) throw new Error("Contract address ไม่ถูกต้อง");

    const code = await state.provider.getCode(address);
    if (code === "0x") {
      state.contract = null;
      throw new Error(`ไม่พบ Smart Contract ที่ address นี้บน ${config.network.name} ตรวจสอบ contract address`);
    }

    state.contract = new ethers.Contract(address, BANK_ABI, state.signer);
    storeAddress(address);
    log(`เชื่อมต่อ Smart Contract สำเร็จ: ${address}`, "ok");
    await refreshBankBalance();
  }

  async function refreshWalletBalance() {
    const wei = await state.provider.getBalance(state.account);
    el.walletBalance.textContent = `${ethers.formatEther(wei)} ETH`;
    return wei;
  }

  async function refreshBankBalance() {
    const wei = await state.contract.checkBlance();
    el.bankBalance.textContent = ethers.formatEther(wei);
    return wei;
  }

  function parseAmount() {
    const raw = el.amount.value.trim();
    let wei;
    try {
      wei = ethers.parseEther(raw);
    } catch {
      throw new Error("กรุณากรอกจำนวนเงิน (ETH) ให้ถูกต้อง เช่น 0.01");
    }
    if (wei <= 0n) throw new Error("จำนวนเงินต้องมากกว่า 0");
    return wei;
  }

  async function sendTransaction(label, eventName, submit) {
    log(`${label}: รอการยืนยันใน MetaMask...`, "pending");
    const tx = await submit();
    log(`${label}: Transaction pending... (${tx.hash})`, "pending");
    const receipt = await tx.wait();

    const event = receipt.logs
      .map((entry) => state.contract.interface.parseLog(entry))
      .find((parsed) => parsed?.name === eventName);
    const amount = event ? `${ethers.formatEther(event.args.amount)} ETH ` : "";
    log(`${label} success! ${amount}(block ${receipt.blockNumber})`, "ok");

    el.amount.value = "";
    await Promise.all([refreshBankBalance(), refreshWalletBalance()]);
  }

  async function checkBalance() {
    const wei = await refreshBankBalance();
    await refreshWalletBalance();
    log(`CheckBalance: ยอดเงินในธนาคาร ${ethers.formatEther(wei)} ETH`, "ok");
  }

  async function deposit() {
    const value = parseAmount();
    const walletBalance = await refreshWalletBalance();
    if (value >= walletBalance) {
      throw new Error(`ETH ใน wallet ไม่พอ (มี ${ethers.formatEther(walletBalance)} ETH และต้องเหลือไว้จ่ายค่า gas)`);
    }
    await sendTransaction("Deposit", "Deposit", () => state.contract.deposit({ value }));
  }

  async function withdraw() {
    const amount = parseAmount();
    const balance = await refreshBankBalance();
    if (amount > balance) {
      throw new Error(`not enough money: ยอดคงเหลือ ${ethers.formatEther(balance)} ETH`);
    }
    await sendTransaction("Withdraw", "Withdraw", () => state.contract.withdraw(amount));
  }

  function bindWalletEvents() {
    if (!window.ethereum?.on) return;
    window.ethereum.on("accountsChanged", (accounts) => {
      resetWallet();
      if (accounts.length === 0) {
        log("MetaMask ถูกตัดการเชื่อมต่อ");
        return;
      }
      run(connectWallet);
    });
    // MetaMask recommends a reload on network change to drop stale provider state.
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  async function restoreSession() {
    if (!window.ethereum) return;
    const accounts = await window.ethereum.request({ method: "eth_accounts" });
    if (accounts.length > 0) await run(connectWallet);
  }

  function init() {
    el.studentId.textContent = config.student.id;
    el.studentName.textContent = config.student.name;
    el.contractAddress.value = readStoredAddress() || config.contractAddress;

    el.connectBtn.addEventListener("click", () => run(connectWallet));
    el.contractForm.addEventListener("submit", (event) => {
      event.preventDefault();
      run(connectContract);
    });
    el.txForm.addEventListener("submit", (event) => event.preventDefault());
    el.checkBtn.addEventListener("click", () => run(checkBalance));
    el.depositBtn.addEventListener("click", () => run(deposit));
    el.withdrawBtn.addEventListener("click", () => run(withdraw));

    bindWalletEvents();
    render();
    if (!window.ethereum) log("ไม่พบ MetaMask กรุณาติดตั้ง MetaMask extension", "err");
    restoreSession().catch((err) => log(errorMessage(err), "err"));
  }

  init();
})();
