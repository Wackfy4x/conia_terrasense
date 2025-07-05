var express = require('express');
var router = express.Router();
const userservice = require("../services/user.service");
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');

// Configuration Multer pour stockage en mémoire
const tempStorage = multer.memoryStorage();
const upload = multer({
  storage: tempStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max par fichier
    files: 10 // Max 10 fichiers
  }
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || 'https://api.externe.com/process';
const exifr = require('exifr');
// const API_KEY = process.env.API_KEY || 'votre_cle_api';

// Configuration du stockage final pour Multer
const finalStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

async function getImageDimensions(buffer) {
  try {
    const { width, height } = await sharp(buffer).metadata();
    return `${width}x${height}`;
  } catch {
    return 'Inconnu';
  }
}

const saveFile = multer({ storage: finalStorage }).single('file');

router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Aucun fichier reçu.' });
    }


    const processedFiles = await Promise.all(req.files.map(async (file) => {
      try {
        let metadata = {};
        let data = {
          latitude: 0,
          longitude: 0,
          status: "",
          filename: ""
        };
        try {
          metadata = await exifr.parse(file.buffer);
          console.log(metadata);
          data.latitude = metadata.latitude;
          data.longitude = metadata.longitude;
          data.DateTimeOriginal = metadata.DateTimeOriginal;
        } catch (metaError) {
          console.error('Erreur extraction métadonnées:', metaError.message);
        }

        const formData = new FormData();
        formData.append('files', file.buffer, {
          filename: file.originalname,
          contentType: file.mimetype
        });

        const apiResponse = await axios.post(`${EXTERNAL_API_URL}/analyze_traffic_batch`, formData,
        //     {
        //   headers: {
        //     ...formData.getHeaders(),
        //     // 'Authorization': `Bearer ${API_KEY}`
        //   },
        //   maxContentLength: Infinity,
        //   maxBodyLength: Infinity
        // }
        );
        const fileName = Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname);
        const filePath = path.join(__dirname, '../uploads', fileName);

        fs.writeFileSync(filePath, file.buffer);

        let filenameurl = `http://${host}:${port}/file/${fileName}`
        data.filename = filenameurl;
        data.status = apiResponse.data.individual_results.status;
        let sdata = await userservice.save_filedata(data);
        return {
          status: 'success',
          fileName: filenameurl,
          apiResponse: apiResponse.data,
          path: filePath,
          metadata: sdata
        };
      } catch (apiError) {
        return {
          status: 'error',
          originalName: file.originalname,
          error: apiError.message,
          apiError: apiError.response?.data
        };
      }
    }));

    // Séparation des résultats réussis et échoués
    const successfulUploads = processedFiles.filter(f => f.status === 'success');
    const failedUploads = processedFiles.filter(f => f.status === 'error');

    res.status(200).json({
      message: `Traitement terminé - ${successfulUploads.length} succès, ${failedUploads.length} échecs`,
      successful: successfulUploads,
      failed: failedUploads
    });

  } catch (e) {
    console.error('Erreur globale:', e);
    res.status(500).json({
      error: 'Erreur lors du traitement des fichiers',
      details: e.message,
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
});

router.post("/download", async function(req,res,next){
  try {
    res.json(await userservice.download_image(req.query.url, res));
  } catch (error) {
    console.log(error);
    next(error)
  }
});

router.post("/newnotification", async function(req,res,next){
  try {
    res.json(await userservice.createNotification(req.app.get('socketio')));
  } catch (error) {
    console.log(error);
    next(error)
  }
});

router.get("/all", async function(req,res,next){
  try {
    res.json(await userservice.getAll_embouteillage());
  } catch (error) {
    console.log(error);
    next(error)
  }
});
module.exports = router;
