# Vijey Textile — Complete Deployment Guide
# Shop Ground Floor No 131, Texvalley Gangapuram, Erode – 638004

================================================================
STORE DETAILS
================================================================
Store Name    : Vijey Textile
Products      : Baby Frocks, Chudithar, Frocks, Western Dresses, Lehenga, Party Wear
               (Girls 3 months to 16 years)
Phone 1       : +91 99941 68839
Phone 2       : +91 94439 47853
Admin Email   : kumaragurubaran27102@gmail.com
Frontend URL  : https://vijeytextile.com  (set up on Vercel)
Backend URL   : https://vijey-textile.onrender.com  (set up on Render)

================================================================
STEP 1 — PUSH CODE TO GITHUB
================================================================
1. Go to github.com and create a new repository named: vijey-textile
2. Make it Private
3. Open terminal in this folder (Folder 3/vijey-textile) and run:

   git init
   git add .
   git commit -m "Initial commit — Vijey Textile website"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/vijey-textile.git
   git push -u origin main

================================================================
STEP 2 — DEPLOY BACKEND ON RENDER
================================================================
1. Go to render.com → New → Web Service
2. Connect your GitHub account → select vijey-textile repo
3. Settings:
   - Root Directory : backend
   - Build Command  : pip install -r requirements.txt
   - Start Command  : uvicorn main:app --host 0.0.0.0 --port $PORT
   - Instance Type  : Free

4. Add Environment Variables on Render:
   (Go to Environment tab and add each one)

   DATABASE_URL         = (copy from Render PostgreSQL — create a new DB first)
   SECRET_KEY           = (generate a random 32-char string)
   ADMIN_EMAIL          = kumaragurubaran27102@gmail.com
   ADMIN_PASSWORD       = (your strong admin password)
   ADMIN_PHONE          = 9994168839

   RAZORPAY_KEY_ID      = (from Razorpay Dashboard → API Keys)
   RAZORPAY_KEY_SECRET  = (from Razorpay Dashboard → API Keys)
   RAZORPAY_WEBHOOK_SECRET = (from Razorpay → Settings → Webhooks)

   CLOUDINARY_CLOUD_NAME = (from Cloudinary Dashboard)
   CLOUDINARY_API_KEY    = (from Cloudinary Dashboard)
   CLOUDINARY_API_SECRET = (from Cloudinary Dashboard)

   SMTP_EMAIL           = kumaragurubaran27102@gmail.com
   SMTP_PASSWORD        = (Gmail App Password — 16 chars, no spaces)

   SENDGRID_API_KEY     = (from SendGrid Dashboard — optional, better email delivery)

   ULTRAMSG_TOKEN       = (from Ultramsg Dashboard)
   ULTRAMSG_INSTANCE    = (from Ultramsg Dashboard — e.g. instance12345)

   FAST2SMS_API_KEY     = (from Fast2SMS Dashboard)

   DELHIVERY_API_TOKEN  = (from Delhivery Direct Dashboard)

   SUPPORT_EMAIL        = kumaragurubaran27102@gmail.com
   FRONTEND_URL         = https://vijeytextile.com

5. Create Render PostgreSQL:
   - Render Dashboard → New → PostgreSQL
   - Copy the External Database URL → paste as DATABASE_URL above

================================================================
STEP 3 — DEPLOY FRONTEND ON VERCEL
================================================================
1. Go to vercel.com → New Project → Import from GitHub → vijey-textile
2. Settings:
   - Framework     : Next.js
   - Root Directory: frontend
3. Add Environment Variable:
   NEXT_PUBLIC_API_URL = https://vijey-textile.onrender.com
4. Deploy!

5. Custom Domain (vijeytextile.com via Hostinger):
   - In Vercel → Project → Settings → Domains → Add vijeytextile.com
   - In Hostinger DNS → add CNAME record:
       Name  : www
       Value : cname.vercel-dns.com
   - Also add A record for root domain as instructed by Vercel

================================================================
STEP 4 — SET UP RAZORPAY WEBHOOK
================================================================
1. Go to Razorpay Dashboard → Settings → Webhooks → Add New
2. Webhook URL: https://vijey-textile.onrender.com/api/payments/webhook/razorpay
3. Select events: refund.created, refund.processed
4. Copy the Webhook Secret → add as RAZORPAY_WEBHOOK_SECRET in Render

================================================================
STEP 5 — FIRST LOGIN
================================================================
After deploy:
1. Go to https://vijeytextile.com/auth/login
2. Login with:
   Email    : kumaragurubaran27102@gmail.com
   Password : (the ADMIN_PASSWORD you set in Render)
3. You will receive a 6-digit OTP on your email — enter it to login
4. Go to /admin to access the admin dashboard

================================================================
THIRD-PARTY SERVICE SETUP LINKS
================================================================
Razorpay    : https://razorpay.com  (Payments)
Cloudinary  : https://cloudinary.com  (Product Images)
SendGrid    : https://sendgrid.com  (Email — recommended on Render)
Ultramsg    : https://ultramsg.com  (WhatsApp notifications)
Fast2SMS    : https://fast2sms.com  (SMS — OTP delivery)
Delhivery   : https://www.delhivery.com  (Shipping & tracking)
Render      : https://render.com  (Backend hosting)
Vercel      : https://vercel.com  (Frontend hosting)
Hostinger   : https://hostinger.in  (Domain — vijeytextile.com)

================================================================
PRODUCT CATEGORIES & SIZES
================================================================
Categories:
  - Baby Frocks    (infant girls, soft fabrics, 3M–24M)
  - Chudithar      (traditional sets, all ages)
  - Frocks         (classic & printed frocks)
  - Western Dresses (A-line, denim, shirt dresses)
  - Lehenga        (festive & bridal)
  - Party Wear     (sequin gowns, tutu, velvet)

Size Options:
  Infant : 3M, 6M, 9M, 12M, 18M, 24M
  Toddler: 2-3Y, 3-4Y, 4-5Y, 5-6Y
  Kids   : 6-7Y, 7-8Y, 8-9Y, 9-10Y, 10-11Y, 11-12Y
  Teens  : 12-13Y, 13-14Y, 14-15Y, 15-16Y

================================================================
PRIMARY ADMIN ACCOUNT (PROTECTED)
================================================================
Email    : kumaragurubaran27102@gmail.com
Role     : Primary Admin — cannot be revoked by anyone
Access   : Full admin dashboard (/admin)

Only the primary admin can:
- Remove other admin accounts
- Access all admin features

================================================================
NOTES
================================================================
- Render free tier sleeps after 15 min inactivity (first request ~30s)
- Auto-deploy: every git push to main branch deploys automatically
- Refund webhook auto-updates payment status when Razorpay processes
- All email/WhatsApp colors use pink theme (#7c3aed primary)
- Crown logo files are in frontend/public/ — replace with Vijey Textile logo
