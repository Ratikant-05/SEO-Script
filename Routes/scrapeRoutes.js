import express from 'express';
const router = express.Router();
import {crawlSite,applySEOChanges,getSeoSuggestions} from '../Controllers/scrapeController.js'
import { fetchCrawledData } from '../Controllers/scrapeController.js';

// crawls the website
router.post('/crawl', crawlSite)

// fetching the data to the frontend
router.get('/getData', fetchCrawledData)

// getting SEO suggestions from LLM
router.post('/getSeoSuggestions', getSeoSuggestions)

// apply changes endpoint >>> saves the changes in the DB and apply them to the website
router.post('/apply-changes', applySEOChanges)


export default router;
