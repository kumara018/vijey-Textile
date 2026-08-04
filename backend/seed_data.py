"""Run once to populate the database with sample products and admin user."""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from database import SessionLocal, engine, Base
import models
from auth import hash_password
from dotenv import load_dotenv

load_dotenv()

Base.metadata.create_all(bind=engine)

# ─── Size groups — standard Indian clothing sizes 14–40 ──────────────────────
BABY_SIZES    = ["14", "16", "18", "20", "22", "24"]
KIDS_SIZES    = ["26", "28", "30", "32"]
GIRLS_SIZES   = ["34", "36", "38", "40"]
ALL_SIZES     = BABY_SIZES + KIDS_SIZES + GIRLS_SIZES
OLDER_SIZES   = KIDS_SIZES + GIRLS_SIZES
# aliases kept for readability
INFANT_SIZES  = BABY_SIZES
TODDLER_SIZES = BABY_SIZES

PRODUCTS = [
    # ────────────────────────────────────────────────────────
    # BABY FROCKS  (Sizes 14–24)
    # ────────────────────────────────────────────────────────
    {"name": "Luxury Floral Organic Baby Frock",
     "description": "100% soft organic cotton baby frock with delicate floral embroidery. Snap buttons at back for easy dressing. Gentle on baby skin — perfect for everyday luxury wear.",
     "price": 499.0, "compare_price": 699.0,
     "category": "Baby Frocks", "fabric": "Organic Cotton",
     "size_options": INFANT_SIZES,
     "colors": ["Pink", "Lavender", "Mint Green", "Peach"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 80, "sku": "BF-001", "is_featured": True},

    {"name": "Smocked Bow Luxury Baby Frock",
     "description": "Elegant smocked baby frock with signature gold bow. Cotton-lycra blend for gentle stretch. Perfect for naming ceremonies, birthdays and family gatherings.",
     "price": 649.0, "compare_price": 899.0,
     "category": "Baby Frocks", "fabric": "Cotton Lycra",
     "size_options": INFANT_SIZES,
     "colors": ["White", "Peach", "Sky Blue"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 60, "sku": "BF-002", "is_featured": True},

    {"name": "Silk Embroidered Festive Baby Frock",
     "description": "Luxury silk-blend baby frock with golden thread embroidery. Makes every baby shine at weddings, Diwali and celebrations. Includes matching headband.",
     "price": 999.0, "compare_price": 1399.0,
     "category": "Baby Frocks", "fabric": "Silk Blend",
     "size_options": INFANT_SIZES,
     "colors": ["Red & Gold", "Pink & Gold", "Purple & Gold"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 45, "sku": "BF-003", "is_featured": False},

    {"name": "Ruffle Muslin Baby Frock",
     "description": "Airy muslin ruffle frock — lightweight, breathable and perfect for warm climate. Quick-dry fabric keeps baby comfortable and stylish all day.",
     "price": 399.0, "compare_price": 549.0,
     "category": "Baby Frocks", "fabric": "Muslin Cotton",
     "size_options": INFANT_SIZES,
     "colors": ["Yellow", "Blue", "White", "Pink"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 90, "sku": "BF-004", "is_featured": False},

    # ────────────────────────────────────────────────────────
    # CHUDITHAR  (3Y – 16Y)
    # ────────────────────────────────────────────────────────
    {"name": "Luxury Cotton Chudithar Set for Girls",
     "description": "Premium cotton chudithar set for girls with beautiful printed dupatta. Breathable fabric — perfect for school functions, Pongal, Independence Day and everyday wear. Includes churidar and dupatta.",
     "price": 899.0, "compare_price": 1299.0,
     "category": "Chudithar", "fabric": "Pure Cotton",
     "size_options": OLDER_SIZES,
     "colors": ["Blue", "Green", "Pink", "Yellow"],
     "images": ["/images/placeholder-chudithar.jpg"],
     "stock": 70, "sku": "CH-001", "is_featured": True},

    {"name": "Embroidered Silk Chudithar for Girls",
     "description": "Stunning hand-embroidered silk chudithar for girls. Intricate traditional patterns — perfect for weddings, Deepavali and cultural events. Includes churidar and net dupatta.",
     "price": 1799.0, "compare_price": 2499.0,
     "category": "Chudithar", "fabric": "Art Silk",
     "size_options": OLDER_SIZES,
     "colors": ["Purple", "Red", "Teal", "Royal Blue"],
     "images": ["/images/placeholder-chudithar.jpg"],
     "stock": 40, "sku": "CH-002", "is_featured": True},

    {"name": "Georgette Printed Chudithar",
     "description": "Trendy georgette chudithar with vibrant digital prints. Light, flowy and fashionable — perfect for parties, functions and casual outings for older girls.",
     "price": 1299.0, "compare_price": 1799.0,
     "category": "Chudithar", "fabric": "Georgette",
     "size_options": OLDER_SIZES,
     "colors": ["Multicolor", "Pink", "Peach"],
     "images": ["/images/placeholder-chudithar.jpg"],
     "stock": 55, "sku": "CH-003", "is_featured": False},

    {"name": "Festive Kurthi Palazzo Set",
     "description": "Designer kurthi with matching palazzo pants. Traditional Indian look with modern cut — perfect for Tamil festivals, school annual days and family functions.",
     "price": 999.0, "compare_price": 1399.0,
     "category": "Chudithar", "fabric": "Rayon",
     "size_options": OLDER_SIZES,
     "colors": ["Yellow", "Orange", "Pink", "Mint"],
     "images": ["/images/placeholder-chudithar.jpg"],
     "stock": 60, "sku": "CH-004", "is_featured": False},

    # ────────────────────────────────────────────────────────
    # FROCKS  (Sizes 18–40)
    # ────────────────────────────────────────────────────────
    {"name": "Classic Puff Sleeve Cotton Frock",
     "description": "Timeless cotton frock with puffed sleeves and gathered skirt. A wardrobe essential for every girl — breathable, easy-care. Available in sizes 18 to 40.",
     "price": 599.0, "compare_price": 849.0,
     "category": "Frocks", "fabric": "Pure Cotton",
     "size_options": ALL_SIZES,
     "colors": ["Pink", "Blue", "Yellow", "White", "Red"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 100, "sku": "FR-001", "is_featured": True},

    {"name": "Lace Trim Floral Frock",
     "description": "Elegant floral frock with premium lace collar and hem trim. Soft georgette with smooth lining. Perfect for school events, birthdays and family functions.",
     "price": 799.0, "compare_price": 1099.0,
     "category": "Frocks", "fabric": "Georgette",
     "size_options": OLDER_SIZES,
     "colors": ["Peach", "Lavender", "Mint", "Pink"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 75, "sku": "FR-002", "is_featured": True},

    {"name": "Twirl Umbrella Frock",
     "description": "Girls love to spin in this gorgeous umbrella-cut frock! Vibrant prints, wide flared silhouette — the perfect birthday frock for Baby, Kids & Girls.",
     "price": 699.0, "compare_price": 999.0,
     "category": "Frocks", "fabric": "Polyester",
     "size_options": OLDER_SIZES,
     "colors": ["Multicolor", "Pink Print", "Purple Print"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 80, "sku": "FR-003", "is_featured": False},

    {"name": "Embroidered Collar Luxury Frock",
     "description": "Premium frock with hand-embroidered collar, cuffs and waistband. Cotton-satin blend for a rich look. Ideal for annual days, temple visits and special occasions.",
     "price": 999.0, "compare_price": 1399.0,
     "category": "Frocks", "fabric": "Cotton Satin",
     "size_options": OLDER_SIZES,
     "colors": ["White", "Cream", "Light Pink", "Sky Blue"],
     "images": ["/images/placeholder-frock.jpg"],
     "stock": 55, "sku": "FR-004", "is_featured": False},

    # ────────────────────────────────────────────────────────
    # WESTERN DRESSES  (Sizes 14–40)
    # ────────────────────────────────────────────────────────
    {"name": "Floral A-Line Western Dress",
     "description": "Trendy floral A-line dress with a flared skirt for Baby, Kids & Girls. Cotton-polyester blend — comfortable for daily wear, playdates and school outings.",
     "price": 699.0, "compare_price": 999.0,
     "category": "Western Dresses", "fabric": "Cotton Blend",
     "size_options": OLDER_SIZES,
     "colors": ["Floral Print", "Pink", "Yellow"],
     "images": ["/images/placeholder-western.jpg"],
     "stock": 65, "sku": "WD-001", "is_featured": True},

    {"name": "Denim Pinafore Dress",
     "description": "Stylish denim pinafore with adjustable straps and front pockets. A versatile western staple — pair with T-shirt or wear standalone for school and casual outings.",
     "price": 849.0, "compare_price": 1199.0,
     "category": "Western Dresses", "fabric": "Denim",
     "size_options": OLDER_SIZES,
     "colors": ["Light Blue", "Dark Blue", "Black"],
     "images": ["/images/placeholder-western.jpg"],
     "stock": 50, "sku": "WD-002", "is_featured": True},

    {"name": "Striped Jersey T-Shirt Dress",
     "description": "Fun striped jersey dress for active girls. Elasticated waist, machine washable — available in sizes 14 to 40 for Baby, Kids & Girls.",
     "price": 499.0, "compare_price": 699.0,
     "category": "Western Dresses", "fabric": "Jersey Cotton",
     "size_options": ALL_SIZES,
     "colors": ["Pink Stripe", "Blue Stripe", "Rainbow", "Red Stripe"],
     "images": ["/images/placeholder-western.jpg"],
     "stock": 90, "sku": "WD-003", "is_featured": False},

    {"name": "Polka Dot Shirt Dress",
     "description": "Classic polka dot shirt dress with belt and front buttons. Breathable cotton — perfect for school, outings and casual events. Timeless style for all ages.",
     "price": 649.0, "compare_price": 899.0,
     "category": "Western Dresses", "fabric": "Cotton",
     "size_options": OLDER_SIZES,
     "colors": ["Red & White", "Navy & White", "Black & White"],
     "images": ["/images/placeholder-western.jpg"],
     "stock": 55, "sku": "WD-004", "is_featured": False},

    # ────────────────────────────────────────────────────────
    # LEHENGA  (Sizes 20–40)
    # ────────────────────────────────────────────────────────
    {"name": "Silk Festive Girls Lehenga Set",
     "description": "Luxury art silk lehenga set with rich zari border. Includes stitched choli and matching dupatta. A showstopper at weddings, Diwali and all festive occasions.",
     "price": 2499.0, "compare_price": 3499.0,
     "category": "Lehenga", "fabric": "Art Silk",
     "size_options": ALL_SIZES,
     "colors": ["Red & Gold", "Pink & Gold", "Green & Gold", "Purple & Gold"],
     "images": ["/images/placeholder-lehenga.jpg"],
     "stock": 40, "sku": "LH-001", "is_featured": True},

    {"name": "Embroidered Net Lehenga",
     "description": "Gorgeous embroidered net lehenga with sequin detailing. Makes every little girl feel like a princess — perfect for birthdays, sangeet and reception functions.",
     "price": 3299.0, "compare_price": 4499.0,
     "category": "Lehenga", "fabric": "Net Embroidery",
     "size_options": OLDER_SIZES,
     "colors": ["Pink & Silver", "Purple & Gold", "Blue & Silver"],
     "images": ["/images/placeholder-lehenga.jpg"],
     "stock": 30, "sku": "LH-002", "is_featured": True},

    {"name": "Teen Bridal Lehenga Set",
     "description": "Stunning bridal-style lehenga for girls (sizes 34–40). Heavy embroidery, velvet blouse and net dupatta — the ultimate festive look for weddings and receptions.",
     "price": 4999.0, "compare_price": 6999.0,
     "category": "Lehenga", "fabric": "Velvet & Net",
     "size_options": GIRLS_SIZES,
     "colors": ["Red & Gold", "Maroon & Gold", "Navy & Gold"],
     "images": ["/images/placeholder-lehenga.jpg"],
     "stock": 20, "sku": "LH-003", "is_featured": False},

    {"name": "Cotton Block Print Lehenga",
     "description": "Lightweight cotton lehenga with vibrant block print. Comfortable for long wear — great for Navratri, Pongal, school cultural events and daily celebrations.",
     "price": 1499.0, "compare_price": 1999.0,
     "category": "Lehenga", "fabric": "Cotton",
     "size_options": OLDER_SIZES,
     "colors": ["Multicolor", "Yellow & Red", "Orange & Blue"],
     "images": ["/images/placeholder-lehenga.jpg"],
     "stock": 55, "sku": "LH-004", "is_featured": False},

    # ────────────────────────────────────────────────────────
    # PARTY WEAR  (Sizes 18–40)
    # ────────────────────────────────────────────────────────
    {"name": "Sequin Princess Party Gown",
     "description": "Dazzling sequin gown — every girl feels like a princess. Soft mesh lining for comfort. The ultimate birthday gown for Baby, Kids & Girls (sizes 18–40).",
     "price": 2199.0, "compare_price": 2999.0,
     "category": "Party Wear", "fabric": "Sequin Net",
     "size_options": ALL_SIZES,
     "colors": ["Gold", "Silver", "Pink", "Purple"],
     "images": ["/images/placeholder-party.jpg"],
     "stock": 35, "sku": "PW-001", "is_featured": True},

    {"name": "Tutu Ruffle Birthday Dress",
     "description": "Magical layered tulle tutu dress with satin bodice and gold bow. The dream birthday dress — every girl will love twirling in this! Sizes 18 to 40.",
     "price": 1799.0, "compare_price": 2499.0,
     "category": "Party Wear", "fabric": "Tulle & Satin",
     "size_options": ALL_SIZES,
     "colors": ["Pink", "White", "Lavender", "Teal"],
     "images": ["/images/placeholder-party.jpg"],
     "stock": 45, "sku": "PW-002", "is_featured": True},

    {"name": "Velvet Festive Party Frock",
     "description": "Rich velvet party frock with lace overlay and ribbon waistband. Premium look — perfect for Christmas, New Year and festive family functions.",
     "price": 1599.0, "compare_price": 2199.0,
     "category": "Party Wear", "fabric": "Velvet",
     "size_options": OLDER_SIZES,
     "colors": ["Red", "Emerald Green", "Navy Blue", "Purple"],
     "images": ["/images/placeholder-party.jpg"],
     "stock": 40, "sku": "PW-003", "is_featured": False},

    {"name": "Floral Organza Teen Party Gown",
     "description": "Dreamy organza gown with 3D floral applique and flared skirt. For girls (sizes 34–40) — a showstopper at any party, wedding or reception.",
     "price": 3499.0, "compare_price": 4799.0,
     "category": "Party Wear", "fabric": "Organza",
     "size_options": GIRLS_SIZES,
     "colors": ["Pink", "White", "Gold", "Purple"],
     "images": ["/images/placeholder-party.jpg"],
     "stock": 25, "sku": "PW-004", "is_featured": True},
]


def seed():
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "admin@vijeytextile.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123456")

        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing_admin:
            admin = models.User(
                full_name="Vijey Textile Admin",
                email=admin_email,
                phone="9443947853",
                password_hash=hash_password(admin_password),
                is_admin=True,
            )
            db.add(admin)
            print(f"Admin created: {admin_email} / {admin_password}")
        else:
            print(f"Admin already exists: {admin_email}")

        existing_count = db.query(models.Product).count()
        if existing_count == 0:
            for p in PRODUCTS:
                product = models.Product(**p)
                db.add(product)
            print(f"Added {len(PRODUCTS)} products")
        else:
            print(f"Products already exist ({existing_count}). Skipping seed.")

        db.commit()
        print("Database seeded successfully!")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
