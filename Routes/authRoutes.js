import express from 'express';
import {registerSiteController, SignUpController ,LoginController, getAllCrawledData} from '../Controllers/authController.js'
const router = express.Router();

// sign up route
router.post('/signup', SignUpController);

// login route
router.post('/login', LoginController);

// Register a new site
router.post('/register-site', registerSiteController);

// display registered site's data
router.get('/displayData', getAllCrawledData);

export default router;
