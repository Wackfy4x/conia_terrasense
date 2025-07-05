const db = require('./db.service');
const helper = require('../helper');
const config = require('../config');
var apps = require('../app');
const path = require("path");
const fs = require("fs");
const multer = require('multer');
const axios = require('axios');

async function getUserById(id){

    const rows=await db.query(
        "SELECT * FROM user WHERE id="+id+""
    )
    let data=helper.emptyorRows(rows);

    return {
        data
    }
}

async function createNotification(io) {
    let description = "embouteillage a nkoabang";
    let userId = null;
    let type = 'info';
    if (!description) {
        throw new Error("La description de la notification est requise.");
    }
    if (!io) {
        throw new Error("L'instance Socket.IO est requise pour émettre la notification.");
    }

    try {
        const result = await db.query(
            "INSERT INTO notification (description, date) VALUES (?, ?)",
            [description, new Date()]
        );
        console.log(result)
        const data=helper.emptyorRows(result);
        const newNotificationData = {
            // id: result.insertId,
            user_id: userId, // Peut être null si globale
            message: description,
            type: type,
            is_read: false,
            created_at: new Date().toISOString()
        };

        // --- PARTIE CLÉ : Envoyer à tous les utilisateurs si la notification est globale ---
        if (userId === null) { // Si user_id est null, c'est une notification globale
            io.emit("newNotification", newNotificationData);
            console.log(`Notification globale émise: "${description}"`);
        } else {
            // Sinon, si c'est pour un utilisateur spécifique, on envoie à sa room
            io.to(`user_${userId}`).emit("newNotification", newNotificationData);
            console.log(`Notification émise à l'utilisateur ${userId}: "${description}"`);
        }
        // --------------------------------------------------------------------------

        return newNotificationData;
    } catch (e) {
        console.error("Erreur lors de la création de la notification dans la DB:", e);
        throw new Error("Échec de la création de la notification: " + e.message);
    }
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Types MIME pour les images et vidéos
        const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        const videoMimeTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm'];

        // Déterminer le sous-dossier selon le type de fichier
        let subfolder;
        if (imageMimeTypes.includes(file.mimetype)) {
            subfolder = 'images';
        } else if (videoMimeTypes.includes(file.mimetype)) {
            subfolder = 'videos';
        } else {
            throw new Error("type de fichier pas pris en charge .")
        }

        // Construire le chemin complet
        const uploadPath = path.join(__dirname, '../uploads', subfolder);

        // Créer le dossier s'il n'existe pas
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }

        cb(null, uploadPath);
    },

    filename: (req, file, cb) => {
        // Générer un nom de fichier unique avec l'extension originale
        const uniqueName = `${Date.now()}-${file.originalname}`;
        console.log(uniqueName);
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 100 // Limite à 100MB par fichier
    },
    fileFilter: (req, file, cb) => {
        // Autoriser seulement certains types de fichiers
        const allowedTypes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp',
            'video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm',
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'), false);
        }
    }
});


async function save_filedata(data) {
    if (!data.latitude || !data.longitude || !data.DateTimeOriginal) {
        return null;
    }
    try {
        const result = await db.query(
            "INSERT INTO metadonnee (filename, latitude, longitude,  date, embouteillage) VALUES (?, ?, ?, ?, ?)",
            [data.filename, data.latitude, data.longitude, data.DateTimeOriginal, data.status === "embouteillage"]
        );
        console.log(result);
        const datar=helper.emptyorRows(result);
        if(data.status === "embouteillage") {
            let userId = null;
            const newNotificationData = {
                // id: result.insertId,
                user_id: userId,
                latitude: datar.latitude,
                longitude: datar.longitude,
            };

            // --- PARTIE CLÉ : Envoyer à tous les utilisateurs si la notification est globale ---
            if (userId === null) { // Si user_id est null, c'est une notification globale
                io.emit("newNotification", newNotificationData);
                console.log(`Notification globale émise: "${newNotificationData}"`);
            } else {
                // Sinon, si c'est pour un utilisateur spécifique, on envoie à sa room
                io.to(`user_${userId}`).emit("newNotification", newNotificationData);
                console.log(`Notification émise à l'utilisateur ${userId}: "${newNotificationData}"`);
            }
        }
        // --------------------------------------------------------------------------

        return datar;
    } catch (e) {
        console.error("Erreur l'insertion des metadonnee dans la DB:", e);
        throw new Error("Erreur lors de l'insertion des metadonnees: " + e.message);
    }
}

function filterByDate(items) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return items.filter(item => {
        const itemDate = new Date(item.date);
        // console.log(itemDate.getHours());
        console.log(new Date().getHours() - 1)
        return itemDate.getHours() <= (new Date().getHours() - 1);
    });
}

async function getAll_embouteillage() {
    const rows=await db.query(
        "SELECT * FROM metadonnee WHERE embouteillage=0"
    )
    let data=helper.emptyorRows(rows);
    data = filterByDate(data);
    console.log(data);
    return {
        data
    }
}
module.exports = {
    getUserById,
    createNotification,
    save_filedata,
    upload,
    getAll_embouteillage
};
