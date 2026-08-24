// QR code generation, bundled from the `qrcode` npm package (MIT licensed)
// so codes render entirely client-side -- nothing sent to any server.
import QRCode from 'qrcode';
window.QRCode = QRCode;
