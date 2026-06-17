const express = require('express');
const qrcode = require('qrcode-terminal');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require('@whiskeysockets/baileys');

const app = express();
app.use(express.json());

let sock;

async function startWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');

    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\nScan the QR Code:\n');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('WhatsApp Connected');
        }

        if (connection === 'close') {
            console.log('Connection Closed');

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !==
                DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log('Reconnecting...');
                startWhatsApp();
            } else {
                console.log('Logged out. Scan QR again.');
            }
        }
    });
}

startWhatsApp();

app.get('/', (req, res) => {
    res.json({
        status: 'running',
        service: 'Baileys WhatsApp API'
    });
});

app.post('/send', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                error: 'phone and message are required'
            });
        }

        if (!sock) {
            return res.status(500).json({
                success: false,
                error: 'WhatsApp not connected'
            });
        }

        await sock.sendMessage(
            `${phone}@s.whatsapp.net`,
            { text: message }
        );

        return res.json({
            success: true,
            sentTo: phone,
            message
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});