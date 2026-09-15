# Eshop-rychle deployment bridge

Cíl: změny CSS se zapisují do tohoto repozitáře a následně se nasazují do Eshop-rychle bez ručního kopírování uživatelem.

## Aktuální stav

- Zdroj změn: GitHub repozitář `tomasoswald/eshop-css`
- Aktivní CSS override: `sale-pill.css`
- Cílový e-shop: FITNESSIO / Eshop-rychle.cz
- Přímé nasazení do administrace zatím není aktivní, protože chybí autorizované rozhraní/relace k administraci Eshop-rychle.

## Bezpečnost

Do repozitáře se nesmí ukládat přihlašovací heslo, session cookie ani jiné tajné údaje.

## Požadovaný provoz

1. ChatGPT upraví CSS v GitHubu.
2. Deployment bridge změnu převezme.
3. Bridge aktualizuje vlastní CSS v Eshop-rychle a publikuje změnu.
4. Uživatel pouze zkontroluje výsledek na živém e-shopu.
