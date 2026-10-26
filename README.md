# Bank DApp (Assignment 5)

เว็บ DApp สำหรับใช้งาน Bank Smart Contract ([contracts/Bank.sol](contracts/Bank.sol)) ผ่าน MetaMask
Static site (HTML/CSS/JS + ethers.js v6 จาก CDN) ไม่ต้อง build พร้อมขึ้น GitHub Pages

## Features

- แสดงรหัสนักศึกษา และชื่อ-สกุล ที่ header
- Connect MetaMask (แสดง account, network, wallet balance) และติดตามการเปลี่ยน account/network
- ถ้า MetaMask อยู่ผิด network จะขอให้เปลี่ยนเป็น network ที่ตั้งไว้ใน config (Sepolia) อัตโนมัติ
- Connect Smart Contract (ตรวจว่ามี contract อยู่ที่ address บน network ปัจจุบัน)
- Deposit, Withdraw, CheckBalance (`checkBlance()`) พร้อม feedback: pending / success / error
- ปุ่มธุรกรรมถูกล็อกจนกว่าจะเชื่อมต่อ MetaMask และ Contract สำเร็จ

## Setup

1. Deploy `contracts/Bank.sol` ด้วย Remix (Environment: `Injected Provider - MetaMask`) บน testnet เช่น Sepolia หรือ local chain (Ganache)
2. แก้ [config.js](config.js): `student.id`, `student.name`, `network`, `contractAddress`
3. ทดสอบในเครื่อง: `python3 -m http.server 8000` แล้วเปิด http://localhost:8000 (MetaMask ไม่ทำงานกับ `file://`)

## Deploy to GitHub Pages

1. Push repository ขึ้น GitHub
2. Settings > Pages > Source: `Deploy from a branch`, Branch: `main`, Folder: `/ (root)`
3. URL: `https://<username>.github.io/<repo>/` นำไปส่งในระบบ dlearning
