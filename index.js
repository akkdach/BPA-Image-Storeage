
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.urlencoded({ extended: true }));
const PORT = process.env.PORT;


const NAS_DIR = process.env.NAS_DIR;
if (!NAS_DIR) {
	throw new Error('NAS_DIR environment variable is not set');
}
if (!fs.existsSync(NAS_DIR)) {
	fs.mkdirSync(NAS_DIR, { recursive: true });
}

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE = 5 * 1024 * 1024; 

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		const { tradCode, orderType, year, month, orderId } = req.body;
		if (!tradCode || !orderType || !year || !month || !orderId) {
			return cb(new Error(JSON.stringify({ status: 'error', message: 'Missing required fields in payload' })));
		}
		//เช็ค format ปี-เดือน
		const yearRegex = /^\d{4}$/;
		const monthRegex = /^(0[1-9]|1[0-2])$/;
		if (!yearRegex.test(year)) {
			const err = new Error(JSON.stringify({ status: 'error', message: 'Invalid year format. Year must be YYYY.' }));
			err.status = 400;
			return cb(err);
		}
		if (!monthRegex.test(month)) {
			const err = new Error(JSON.stringify({ status: 'error', message: 'Invalid month format. Month must be MM (01-12).' }));
			err.status = 400;
			return cb(err);
		}
		const subDir = path.join(NAS_DIR, tradCode, orderType, year, month, orderId);
		fs.mkdirSync(subDir, { recursive: true });
		cb(null, subDir);
	},
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase();
		const base = path.basename(file.originalname, ext);
		const unique = `${Date.now()}-${base}${ext}`;
		cb(null, unique);
	}
});

const fileFilter = (req, file, cb) => {
	const ext = path.extname(file.originalname).toLowerCase();
	if (!ALLOWED_EXT.includes(ext)) {
		return cb(new Error('Invalid file extension'));
	}
	if (!ALLOWED_MIME.includes(file.mimetype)) {
		return cb(new Error('Invalid MIME type'));
	}
	cb(null, true);
};

const upload = multer({
	storage,
	fileFilter,
	limits: { fileSize: MAX_SIZE }
});


app.post('/upload', (req, res) => {
	upload.single('image')(req, res, function (err) {
		const { tradCode, orderType, year, month, orderId } = req.body;
		if (err instanceof multer.MulterError) {
			if (err.code === 'LIMIT_FILE_SIZE') {
				return res.status(400).json({ status: 'error', message: 'File too large. Max 5MB allowed.' });
			}
			return res.status(400).json({ status: 'error', message: err.message });
		} else if (err) {
		
			try {
				const json = JSON.parse(err.message);
				return res.status(400).json(json);
			} catch {
				return res.status(400).json({ status: 'error', message: err.message });
			}
		}
		if (!req.file) {
			return res.status(400).json({ status: 'error', message: 'No file uploaded' });
		}
		if (!tradCode || !orderType || !year || !month || !orderId) {
			return res.status(400).json({ status: 'error', message: 'Missing required fields in payload' });
		}
		const relativePath = path.join(tradCode, orderType, year, month, orderId, req.file.filename);
		res.json({ message: 'Image saved', path: relativePath });
	});
});


app.get('/image/:tradCode/:orderType/:year/:month/:orderId/:filename', (req, res) => {
	const { tradCode, orderType, year, month, orderId, filename } = req.params;

	const yearRegex = /^\d{4}$/;
	const monthRegex = /^(0[1-9]|1[0-2])$/;
	if (!yearRegex.test(year) || !monthRegex.test(month)) {
		return res.status(400).json({ status: 'error', message: 'Invalid year or month format.' });
	}
    // Set path
	const filePath = path.join(NAS_DIR, tradCode, orderType, year, month, orderId, filename);
	if (!fs.existsSync(filePath)) {
		return res.status(404).json({ status: 'error', message: 'Image not found' });
	}

    // เช็ค MIME type
	const ext = path.extname(filename).toLowerCase();
	let mime = 'application/octet-stream';
	if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
	else if (ext === '.png') mime = 'image/png';
	else if (ext === '.webp') mime = 'image/webp';
	const stat = fs.statSync(filePath);

    // Set headers
	res.setHeader('Content-Type', mime);
	res.setHeader('Content-Length', stat.size);
	res.setHeader('Cache-Control', 'public, max-age=86400');

	const stream = fs.createReadStream(filePath);
	stream.pipe(res);
});

app.listen(PORT, () => {
	console.log(`Server running on http://localhost:${PORT}`);
});

