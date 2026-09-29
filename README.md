# Kiosk OS — دليل التثبيت

نظام كيوسك مبني على Debian 12 للـ MacBook Pro Retina 2012.
بيفتح على شاشة اليوزرز، وكل يوزر بيشوف الـ apps بتاعته بس. كل app عبارة عن لينك بيفتح فول سكرين، من غير ما الدومين يظهر.

---

## 1) قبل ما تبدأ

- **قفل الـ Mac نفسه (مهم):** من macOS Recovery (`Cmd + R` وقت البوت) افتح Utilities ثم Startup Security Utility، وحط **Firmware Password**. من غيره أي حد يقدر يدوس `Option` وقت البوت ويشغّل الجهاز من فلاشة.
- **نت سلك وقت التثبيت:** كارت الواي فاي بتاع الجهاز (Broadcom) مش هيشتغل غير بعد السكريبت. استخدم Thunderbolt-to-Ethernet، أو USB tethering من الموبايل.

## 2) تثبيت Debian

1. نزّل `debian-12.x.x-amd64-netinst.iso` واعمله فلاشة بـ balenaEtcher أو Rufus.
2. دوس `Option` وقت البوت واختار الفلاشة.
3. في التثبيت:
   - امسح الديسك كله: Guided, use entire disk.
   - في شاشة **Software selection** شيل العلامة من **كل حاجة** إلا `standard system utilities`. ممكن كمان تسيب `SSH server` لو هتدخل عليه من بعيد.
4. بعد الريستارت، ادخل باليوزر اللي عملته أثناء التثبيت.

## 3) تشغيل السكريبت

الـ repo **Private**، فمحتاج token للقراءة بس:

1. على GitHub افتح **Settings → Developer settings → Fine-grained tokens → Generate new token**.
2. في **Repository access** اختار `kiosk-os` بس.
3. في **Permissions** اختار **Contents: Read-only**.
4. انسخ الـ token.

على الماك:

```bash
su -              # أو sudo -i
apt install -y git
git clone https://github.com/ahmedmotta/kiosk-os.git /opt/kiosk-os-src
#   Username: ahmedmotta
#   Password: الصق الـ token هنا
cd /opt/kiosk-os-src
bash install.sh
reboot
```

**تحديث الجهاز بعد كده** (من الـ Terminal في لوحة الأدمن):

```bash
cd /opt/kiosk-os-src && sudo git pull && sudo bash install.sh
```

الأمر ده بيحدّث الواجهة بس. اليوزرز والـ apps والتوكنز مش بيتمسحوا.

السكريبت هيسألك على:
- **الاسم** اللي يظهر على الشاشة.
- **يوزر وباسورد الأدمن.** الباسورد ده بيتستخدم في 3 أماكن: لوحة الأدمن، والـ Terminal (يوزر لينكس اسمه `kioskadmin`)، وقائمة GRUB.

بعد الريستارت، الجهاز بيفتح على شاشة بيضا فيها لوجو Innovation IT Hub واسمك والجملة، وبعدين على شاشة اليوزرز على طول.

عشان تغيّر شكل شاشة البوت، بدّل `plymouth/kioskos/splash.png` بصورة جديدة (PNG بخلفية شفافة)، وشغّل `install.sh` تاني.

## 4) إعداد Cloudflare (توكن لكل يوزر)

الفكرة: كل دومين محمي بـ Cloudflare Access، ومايفتحش غير بـ **Service Token**. كل ابن ليه توكن خاص بيه، فيوسف مايقدرش يفتح صفحات فريدة والعكس. وأي حد يفتح اللينك من أي جهاز تاني هياخد 403.

**مثال للدومينات:**

| اليوزر | الـ Apps |
|---|---|
| يوسف | `yousef-code.example.com` و `yousef-quran.example.com` |
| فريدة | `farida-code.example.com` و `farida-quran.example.com` |

**الخطوات في Cloudflare Zero Trust:**

1. **Networks → Tunnels:** ضيف الـ 4 hostnames على التانل بتاعك، كل واحد يشاور على الصفحة بتاعته.
2. **Access → Service Auth → Service Tokens → Create:**
   - اعمل `yousef-kiosk` و `farida-kiosk`، واختار المدة **Non-expiring** أو سنة.
   - انسخ **Client ID** و **Client Secret** لكل توكن فوراً، لأن الـ Secret بيظهر مرة واحدة بس.
3. **Access → Applications → Add → Self-hosted:**
   - Application **"Yousef"**: ضيف الدومينين بتوعه.
   - Policy: Action = **Service Auth**، و Include = **Service Token** = `yousef-kiosk`.
   - كرر نفس الخطوات لفريدة بالتوكن بتاعها.

> لازم الـ Action تبقى **Service Auth** مش Allow. لو اخترت Allow، هتظهر صفحة تسجيل دخول بدل الصفحة.

## 5) إضافة اليوزرز والـ Apps

على الجهاز، دوس **`Ctrl + Alt + A`** وادخل بيوزر الأدمن.

1. **Apps → Add app:** الاسم، واللينك الكامل (`https://yousef-code.example.com`)، والأيقونة، واللون. كرر للـ 4 apps.
2. **Users → Add user:**
   - **يوسف:** علّم على الـ app بتاعة الكودينج والـ app بتاعة القرآن بتوعه، وحط الـ Client ID والـ Client Secret بتوع `yousef-kiosk`.
   - **فريدة:** نفس الكلام بالتوكن بتاعها. ولأنها لسه مابتقراش، علّم على **No password** عشان تدخل بضغطة على صورتها.

التوكن متخزن على الجهاز بس، ومابيتبعتش غير لدومينات الـ apps بتاعة نفس اليوزر.

## 6) الاستخدام اليومي

| الحاجة | إزاي |
|---|---|
| فتح app | من التاسك بار تحت |
| الرجوع للرئيسية | زرار Home في النوتش فوق |
| الواي فاي | أيقونة الواي فاي (في شاشة الدخول أو في التاسك بار) |
| تسجيل الخروج | الدايرة اللي فيها حروف اسم اليوزر في التاسك بار |
| الصوت | زراير الصوت في كيبورد الماك |
| لوحة الأدمن | `Ctrl + Alt + A` |
| Terminal / تحديث النظام | لوحة الأدمن ← System (هيطلب باسورد `kioskadmin`) |

**تحديث المحتوى:** غيّر على السيرفر عندك، والجهاز هيشوف الجديد أول ما الـ app تتفتح. مش محتاج تعمل أي حاجة على الجهاز.

## 7) لو حاجة مش مظبوطة

كل الأوامر دي من الـ Terminal في لوحة الأدمن.

- **اللوج:** `sudo cat /home/kiosk/kioskos.log`
- **الشاشة كبيرة أو صغيرة زيادة:** عدّل `KIOSK_SCALE` في `/opt/kioskos/start.sh` (جرب `1.5` أو `1`)، وبعدين اعمل Restart.
- **الواي فاي مش ظاهر:**
  ```bash
  sudo modprobe -r b43 bcma; sudo modprobe wl
  nmcli dev wifi list
  ```
- **مشاكل في الجرافيكس** (شاشة سودة أو تقطيع): الجهاز فيه كارتين، Intel و NVIDIA. جرب تضيف `nouveau.modeset=0` لـ `GRUB_CMDLINE_LINUX_DEFAULT` في `/etc/default/grub`، وبعدين `sudo update-grub` وريستارت.
- **عايز تعيد تشغيل الواجهة بس:** `sudo pkill -f electron` وهي هتقوم لوحدها تاني.
- **تحديث كود الواجهة:** `git pull` وبعدين `install.sh` تاني، زي ما هو مشروح في الخطوة 3.

## الملفات

```
install.sh            السكريبت اللي بيحوّل Debian لـ Kiosk OS
app/main.js           الإدارة: الشبابيك، اليوزرز، التوكنز، القفل
app/system.js         الواي فاي، البطارية، الصوت، الإيقاف، الـ Terminal
app/store.js          الإعدادات والباسوردات (/var/lib/kioskos/config.json)
app/ui/               الشكل: شاشة الدخول، التاسك بار، النوتش، لوحة الأدمن
```
