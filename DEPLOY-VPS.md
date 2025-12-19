# 🚀 راهنمای Deploy روی VPS

## مرحله ۱: وصل شدن به سرور

**از Mac ترمینال رو باز کن و بزن:**
```bash
ssh root@srv1089142.hstgr.cloud
```
(پسوردت رو میخواد - همونی که موقع ساخت VPS گذاشتی)

---

## مرحله ۲: نصب Node.js (فقط یکبار)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**چک کن نصب شده:**
```bash
node -v
# باید ببینی: v20.x.x
```

---

## مرحله ۳: نصب pm2 (مدیر پروسس)

```bash
sudo npm install -g pm2
```

---

## مرحله ۴: کلون کردن پروژه

```bash
cd /var/www
sudo mkdir -p patrick-crm
sudo chown $USER:$USER patrick-crm
cd patrick-crm

git clone https://github.com/Mehrshadr/patrick-crm.git .
git checkout feature/advanced-workflows
```

---

## مرحله ۵: نصب Dependencies

```bash
npm install
npx prisma generate
npx prisma migrate deploy
```

---

## مرحله ۶: ساخت و اجرا

```bash
npm run build
pm2 start npm --name "patrick-crm" -- start
pm2 save
pm2 startup
```

---

## مرحله ۷: تنظیم Nginx

```bash
sudo nano /etc/nginx/sites-available/patrick-crm
```

**این رو کپی کن داخلش:**
```nginx
server {
    listen 80;
    server_name patrick.srv1089142.hstgr.cloud;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**فعال کردن:**
```bash
sudo ln -s /etc/nginx/sites-available/patrick-crm /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## مرحله ۸: SSL با Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d patrick.srv1089142.hstgr.cloud
```

---

## ✅ تمام!

حالا برو به:
```
https://patrick.srv1089142.hstgr.cloud
```

---

## 🔄 آپدیت کردن بعداً

هر وقت من تغییری دادم و پوش کردم:
```bash
cd /var/www/patrick-crm
git pull
npm install
npm run build
pm2 restart patrick-crm
```
