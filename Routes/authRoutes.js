import express from 'express';
import {registerSiteController, SignUpController ,LoginController} from '../Controllers/authController.js'
const router = express.Router();

// sign up route
router.post('/signup', SignUpController);

// login route
router.post('/login', LoginController);

// Register a new site
router.post('/register-site', registerSiteController);

export default router;
