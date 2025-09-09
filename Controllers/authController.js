import Site from '../Models/Site.js';
import User from '../Models/authModel.js';
import dotenv from 'dotenv';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

dotenv.config();

export const SignUpController = async (req,res,next)=>{
    try {
        const {username,email,password} = req.body
    
        if(!username || !email || !password){
           res.status(400).json({
            msg:"User details missing"
           })
        }
    
        const existingUser = await User.findOne({
            $or:[
                {username},
                {email}
            ]
        })
    
        if(existingUser){
            res.status(400).json({
                msg:"user details already used"
            })
        }
    
        let newUser = await User.create({
            username:username,
            email:email,
            password:password,
        })
    
        res.status(200).json(newUser)
    } catch (error) {
        console.log(error)
        res.status(500).json({
            msg:error
        })
    }
} 

export const LoginController = async (req,res,next)=>{
    try {
        const {username,email,password} = req.body;
    
        if(!((username || email) && password)){
            res.status(400).json({
             msg:"User details missing"
            })
         }
    
         const existingUser = await User.findOne({
            $or:[
                {username},
                {email}
            ]
        })

        if(!existingUser){
           return res.status(400).json({error:"User does not exist. Please Signup"})
        }
    
        const isMatch =  await bcrypt.compare(password,existingUser.password)
    
        if(!isMatch){
            res.status(400).json({
                msg:'Either Username or password not correct'
            })
        }
    
        const {accessToken,refreshToken} = await generateUserTokens(existingUser._id)
        const options = {
            httpOnly:true
        }
    
        res.status(200)
            .cookie("accessToken",accessToken,options)
            .cookie("refreshToken",refreshToken,options)
            .json({
                existingUser,
                message:"successfully logged in"
            })
    } catch (error) {
        res.status(500).json({
            msg:"Internal Server Error"
        })
        console.log(error)
    }
}

export const registerSiteController = async (req, res) => {
  try {
    const { name, domain } = req.body;
    console.log('Received request body:', req.body);

    if (!name || !domain) {
      console.log('Missing fields - name:', name, 'domain:', domain);
      return res.status(400).json({ error: 'Name and domain are required' });
    }

    // Domain validation
    const domainRegex = /^(localhost(:\d+)?|127\.0\.0\.1(:\d+)?|(\d{1,3}\.){3}\d{1,3}(:\d+)?|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|https?:\/\/.+)$/;
    if (!domainRegex.test(domain)) {
      console.log('Domain validation failed for:', domain);
      return res.status(400).json({ error: 'Invalid domain format. Use: example.com, localhost, or IP address' });
    }

    // Check if domain is already registered
    const existingSite = await Site.findOne({ domain });
    if (existingSite) {
      // Generate script URL based on environment
      const isProduction = req.get('host') !== 'localhost:4444' && !req.get('host').includes('127.0.0.1');
      const scriptSrc = isProduction ? 
        `https://seo-script-hqz1.onrender.com/sniffer.js` : 
        `http://localhost:4444/sniffer.js`;
      const installSnippet = `<script defer src="${scriptSrc}" data-site-id="${existingSite.siteId}"></script>`;
      console.log('Generated install snippet:', installSnippet);
      console.log('Generated install snippet:', existingSite.siteId);
      
      return res.status(200).json({
        siteId: existingSite.siteId,
        name: existingSite.name,
        domain: existingSite.domain,
        installSnippet,
        message: 'Site already registered',
        alreadyRegistered: true,
        registeredAt: existingSite.createdAt
      });
    }

    const siteId = crypto.randomUUID();
    
    const site = new Site({
      siteId,
      name,
      domain
    });

    await site.save();

    // Generate script URL based on environment
    const isProduction = req.get('host') !== 'localhost:4444' && !req.get('host').includes('127.0.0.1');
    const scriptSrc = isProduction ? 
      `https://seo-script-hqz1.onrender.com/sniffer.js` : 
      `http://localhost:4444/sniffer.js`;
    const installSnippet = `<script defer src="${scriptSrc}" data-site-id="${siteId}"></script>`;

    res.status(201).json({
      siteId,
      name,
      domain,
      installSnippet,
      message: 'Site registered successfully',
      alreadyRegistered: false
    });
  } catch (error) {
    console.error('Error registering site:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const generateUserTokens = async (user_id)=>{

    const user = await User.findById(user_id)
    const refreshToken = await user.generateRefreshToken();
    const accessToken = await user.generateAccessToken();
    user.refreshToken = refreshToken

    await user.save()

    return {refreshToken,accessToken};

}