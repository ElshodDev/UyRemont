# Tarjimalar (o'zbekcha → ruscha)

Sayt matnlari kodda **o'zbekcha** yoziladi va `t()` ga o'raladi. O'zbekcha matnning o'zi kalit bo'ladi, ruscha tarjimasi `ru/*.js` lug'atlarida turadi.

```jsx
import { t, specName } from '../i18n';

<h1>{t('Usta chaqirish')}</h1>
<input placeholder={t('Telefon raqam')} aria-label={t('Qidirish')} />
toast.success(t('Manzil saqlandi'));
t('{n} ta sharh', { n: master.reviews_count })   // o'zgaruvchi
specName(spec)                                     // spec.name_uz / spec.name_ru
```

## Qoidalar

1. **Nima o'raladi.** Foydalanuvchi ko'radigan hamma matn o'raladi:
   - JSX matni va atributlar: `placeholder`, `aria-label`, `title`, `alt`;
   - toast va tasdiqlash oynalari;
   - `document.title`.
2. **Nima o'ralmaydi.** API'ga yuboriladigan qiymatlar, URL, `localStorage` kalitlari, CSS klasslari, `console` va bazadagi qiymatlar (tuman nomi filtr qiymati sifatida) o'zgarmaydi, faqat ko'rsatilganda tarjima qilinadi: `t(district)`.
3. **Modul darajasida `t()` chaqirilmaydi.** Fayl yuklanganda bir marta hisoblangan matn til almashganda yangilanmaydi.
   - Yorliqlar xaritasi (`ORDER_STATUSES` kabi) o'zbekcha qoladi.
   - Ko'rsatishda `t(LABELS[x].label)` qilinadi.
   - Matn yasaydigan funksiyalar `t()` ni o'z ichida chaqiradi.
4. **O'zgaruvchilar.** `t()` ichida `${}` ishlatilmaydi. To'g'ri yozilishi: `t('{name}, xush kelibsiz', { name })`. Test buni tekshiradi.
5. **Ruscha ko'plik shakli** lug'atda yoziladi:
   ```js
   '{n} ta sharh': '{n, plural, one {# отзыв} few {# отзыва} many {# отзывов} other {# отзыва}}'
   ```
6. **Server xabarlari** (xato va tasdiqlar) serverda tarjima qilinadi, chunki sayt `Accept-Language` sarlavhasini yuboradi. Ularni saytda qayta tarjima qilish shart emas.
7. **Admin panel** (`pages/Admin*`) faqat o'zbekcha.
8. **Tekshiruv:** `npm test` koddagi har bir `t('...')` matnining ruscha tarjimasi borligini va o'zgaruvchilar mosligini tekshiradi.

## Atamalar

Ruscha matnlarda «Вы» bilan murojaat qilinadi. Uslub qisqa, sodda va do'stona. Tugmalarda buyruq shakli ishlatiladi: «Сохранить», «Вызвать мастера».

| O'zbekcha | Ruscha |
|---|---|
| usta / ustalar | мастер / мастера |
| mijoz | клиент |
| Usta chaqirish | Вызвать мастера |
| tezkor chaqiruv | срочный вызов |
| chaqiruv | вызов |
| buyurtma / Buyurtmalarim | заказ / Мои заказы |
| chiqish narxi | стоимость выезда |
| ish haqi | оплата работы |
| material | материалы |
| yakuniy summa | итоговая сумма |
| ish rejimi | рабочий режим |
| Ishga chiqish / Ishni to'xtatish | Выйти на линию / Уйти с линии |
| Siz ishdasiz / Siz dam olyapsiz | Вы на линии / Вы не на линии |
| taklif | предложение (заказа) |
| Qabul qilish / Rad etish | Принять / Отклонить |
| Yetib keldim / Ishni boshlash / Yakunlash | Я на месте / Начать работу / Завершить |
| Bekor qilish / kech bekor qilish | Отменить / поздняя отмена |
| baholash / sharh / reyting | оценка / отзыв / рейтинг |
| komissiya / Komissiya hisobi / qarz | комиссия / Счёт комиссии / долг |
| murojaat / Murojaatlarim | обращение / Мои обращения |
| Yordam | Помощь |
| tasdiqlangan usta / tasdiqlash | проверенный мастер / проверка |
| Profil / Kirish / Chiqish | Профиль / Войти / Выйти |
| Sevimli ustalar | Избранные мастера |
| Saqlangan manzillar | Сохранённые адреса |
| Taxminiy narxlar | Ориентировочные цены |
| Smeta kalkulyatori | Калькулятор сметы |
| Ommaviy havola | Публичная ссылка |
| Varaqa / vizitka | Листовка / визитка |
| so'm / ming so'm / mln so'm | сум / тыс. сум / млн сум |
| Kelishiladi | Договорная |
| Uy & Remont / Avto-Usta / Maishiy Texnika / Telefon & Komp | Дом и ремонт / Автомастер / Бытовая техника / Телефоны и ПК |
| tuman / Barcha tumanlar | район / Все районы |
| Toshkent | Ташкент |
| Chilonzor, Yunusobod, Mirzo Ulug'bek, Yakkasaroy, Mirobod | Чиланзар, Юнусабад, Мирзо-Улугбек, Яккасарай, Мирабад |
| Sergeli, Uchtepa, Shayxontohur, Olmazor, Yashnobod | Сергели, Учтепа, Шайхантахур, Алмазар, Яшнабад |

«Usta24» nomi tarjima qilinmaydi.
