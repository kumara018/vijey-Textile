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

BABY_SIZES   = ["3M", "6M", "9M", "12M", "18M", "24M"]
TODDLER_SIZES = ["2-3Y", "3-4Y", "4-5Y", "5-6Y"]
KID_SIZES     = ["4-5Y", "5-6Y", "6-7Y", "7-8Y", "S", "M"]
ALL_SIZES     = ["3M", "6M", "9M", "12M", "18M", "24M", "2-3Y", "3-4Y", "4-5Y", "5-6Y", "S", "M"]

PRODUCTS = [
    # ── Baby Frocks ─────────────────────────────────────────────────────
    {
        "name": "Floral Cotton Baby Frock",
        "description": "Adorable floral printed baby frock for infant girls. Made from 100% soft cotton fabric — gentle on baby's skin. Easy snap buttons at the back for quick dressing.",
        "price": 349.0,
        "compare_price": 499.0,
        "category": "Baby Frocks",
        "fabric": "Pure Cotton",
        "size_options": BABY_SIZES,
        "colors": ["Pink", "Yellow", "Mint Green"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 80,
        "sku": "BF-001",
        "is_featured": True,
    },
    {
        "name": "Smocked Baby Frock with Bow",
        "description": "Elegant smocked baby frock with a pretty bow at the back. Soft cotton-lycra blend for comfort and stretch. Perfect for birthdays and family gatherings.",
        "price": 499.0,
        "compare_price": 699.0,
        "category": "Baby Frocks",
        "fabric": "Cotton Lycra",
        "size_options": BABY_SIZES,
        "colors": ["White", "Peach", "Lavender"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 60,
        "sku": "BF-002",
        "is_featured": True,
    },
    {
        "name": "Embroidered Festive Baby Frock",
        "description": "Beautiful embroidered frock for festive occasions. Rich fabric with golden thread work — makes baby look stunning at weddings and celebrations.",
        "price": 799.0,
        "compare_price": 1099.0,
        "category": "Baby Frocks",
        "fabric": "Silk Blend",
        "size_options": BABY_SIZES,
        "colors": ["Red", "Pink", "Golden"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 45,
        "sku": "BF-003",
        "is_featured": False,
    },
    {
        "name": "Ruffle Tier Baby Frock",
        "description": "Cute ruffle-tiered baby frock with puff sleeves. Breathable muslin fabric keeps baby cool and comfortable all day long.",
        "price": 429.0,
        "compare_price": 599.0,
        "category": "Baby Frocks",
        "fabric": "Muslin Cotton",
        "size_options": BABY_SIZES,
        "colors": ["Blue", "Pink", "White"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 70,
        "sku": "BF-004",
        "is_featured": False,
    },
    # ── Western Dresses ─────────────────────────────────────────────────
    {
        "name": "Floral A-Line Western Dress",
        "description": "Trendy floral A-line dress for little girls. Comfortable polyester-cotton blend with a flared skirt. Perfect for outings, playdates and casual occasions.",
        "price": 599.0,
        "compare_price": 849.0,
        "category": "Western Dresses",
        "fabric": "Cotton Blend",
        "size_options": TODDLER_SIZES + ["S", "M"],
        "colors": ["Floral Print", "Pink", "Yellow"],
        "images": ["/images/placeholder-western.jpg"],
        "stock": 65,
        "sku": "WD-001",
        "is_featured": True,
    },
    {
        "name": "Denim Pinafore Dress",
        "description": "Stylish denim pinafore dress for girls. Adjustable straps and side pockets. Pair with a T-shirt or wear standalone — a versatile wardrobe staple.",
        "price": 699.0,
        "compare_price": 999.0,
        "category": "Western Dresses",
        "fabric": "Denim",
        "size_options": KID_SIZES,
        "colors": ["Light Blue", "Dark Blue"],
        "images": ["/images/placeholder-western.jpg"],
        "stock": 50,
        "sku": "WD-002",
        "is_featured": True,
    },
    {
        "name": "Polka Dot Shirt Dress",
        "description": "Cute polka dot shirt dress with front button placket and belt. Soft cotton fabric — comfortable for all-day wear at school or outings.",
        "price": 549.0,
        "compare_price": 749.0,
        "category": "Western Dresses",
        "fabric": "Cotton",
        "size_options": KID_SIZES,
        "colors": ["Red & White", "Navy & White", "Black & White"],
        "images": ["/images/placeholder-western.jpg"],
        "stock": 55,
        "sku": "WD-003",
        "is_featured": False,
    },
    {
        "name": "Striped Casual T-Shirt Dress",
        "description": "Fun striped T-shirt dress for everyday wear. Jersey fabric with elasticated waist. Easy to wear and machine washable — perfect for active girls.",
        "price": 399.0,
        "compare_price": 549.0,
        "category": "Western Dresses",
        "fabric": "Jersey Cotton",
        "size_options": ALL_SIZES,
        "colors": ["Pink Stripe", "Blue Stripe", "Rainbow"],
        "images": ["/images/placeholder-western.jpg"],
        "stock": 90,
        "sku": "WD-004",
        "is_featured": False,
    },
    # ── Frocks ──────────────────────────────────────────────────────────
    {
        "name": "Classic Cotton Frock",
        "description": "Timeless classic cotton frock with puffed sleeves and gathered skirt. A traditional favourite for girls — comfortable, breathable and easy to care for.",
        "price": 499.0,
        "compare_price": 699.0,
        "category": "Frocks",
        "fabric": "Pure Cotton",
        "size_options": ALL_SIZES,
        "colors": ["Pink", "Blue", "Yellow", "White"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 100,
        "sku": "FR-001",
        "is_featured": True,
    },
    {
        "name": "Lace Trim Floral Frock",
        "description": "Pretty floral frock with delicate lace trim at collar and hem. Soft georgette fabric with a smooth lining. Perfect for school events and family functions.",
        "price": 649.0,
        "compare_price": 899.0,
        "category": "Frocks",
        "fabric": "Georgette",
        "size_options": ALL_SIZES,
        "colors": ["Peach", "Lavender", "Mint"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 75,
        "sku": "FR-002",
        "is_featured": True,
    },
    {
        "name": "Printed Umbrella Frock",
        "description": "Stylish umbrella-cut frock with vibrant prints. The flared silhouette twirls beautifully — girls love to spin! Great for birthdays and parties.",
        "price": 549.0,
        "compare_price": 749.0,
        "category": "Frocks",
        "fabric": "Polyester",
        "size_options": ALL_SIZES,
        "colors": ["Multicolor", "Pink Print", "Blue Print"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 80,
        "sku": "FR-003",
        "is_featured": False,
    },
    {
        "name": "Embroidered Collar Frock",
        "description": "Elegant frock with hand-embroidered collar and cuffs. Premium cotton-satin blend with a comfortable fit. Ideal for festive occasions and school annual days.",
        "price": 749.0,
        "compare_price": 999.0,
        "category": "Frocks",
        "fabric": "Cotton Satin",
        "size_options": ALL_SIZES,
        "colors": ["White", "Cream", "Light Pink"],
        "images": ["/images/placeholder-frock.jpg"],
        "stock": 55,
        "sku": "FR-004",
        "is_featured": False,
    },
    # ── Lehenga ─────────────────────────────────────────────────────────
    {
        "name": "Festive Silk Girls Lehenga",
        "description": "Beautiful silk lehenga set for little girls. Comes with matching choli and dupatta. Intricate zari border — perfect for weddings, Diwali and festive occasions.",
        "price": 1999.0,
        "compare_price": 2799.0,
        "category": "Lehenga",
        "fabric": "Art Silk",
        "size_options": ALL_SIZES,
        "colors": ["Red & Gold", "Pink & Gold", "Green & Gold"],
        "images": ["/images/placeholder-lehenga.jpg"],
        "stock": 40,
        "sku": "LH-001",
        "is_featured": True,
    },
    {
        "name": "Embroidered Net Lehenga Set",
        "description": "Gorgeous embroidered net lehenga with sequin detailing. Includes stitched choli and net dupatta. Makes every little girl feel like a princess.",
        "price": 2499.0,
        "compare_price": 3499.0,
        "category": "Lehenga",
        "fabric": "Net",
        "size_options": ALL_SIZES,
        "colors": ["Pink", "Purple", "Blue"],
        "images": ["/images/placeholder-lehenga.jpg"],
        "stock": 30,
        "sku": "LH-002",
        "is_featured": True,
    },
    {
        "name": "Cotton Block Print Lehenga",
        "description": "Lightweight cotton lehenga with hand block print. Comfortable for long wear — great for Navratri, Pongal and cultural events.",
        "price": 1299.0,
        "compare_price": 1799.0,
        "category": "Lehenga",
        "fabric": "Cotton",
        "size_options": ALL_SIZES,
        "colors": ["Multicolor", "Yellow & Pink", "Orange & Red"],
        "images": ["/images/placeholder-lehenga.jpg"],
        "stock": 50,
        "sku": "LH-003",
        "is_featured": False,
    },
    # ── Party Wear ──────────────────────────────────────────────────────
    {
        "name": "Sequin Princess Party Gown",
        "description": "Dazzling sequin party gown that makes every little girl feel like a princess. Soft mesh lining underneath for comfort. Perfect for birthday parties and celebrations.",
        "price": 1799.0,
        "compare_price": 2499.0,
        "category": "Party Wear",
        "fabric": "Sequin Net",
        "size_options": ALL_SIZES,
        "colors": ["Gold", "Silver", "Pink"],
        "images": ["/images/placeholder-party.jpg"],
        "stock": 35,
        "sku": "PW-001",
        "is_featured": True,
    },
    {
        "name": "Tutu Ruffle Party Dress",
        "description": "Magical tutu party dress with layers of soft tulle. Satin bodice with bow accent. The dream dress for every little girl's birthday or special event.",
        "price": 1499.0,
        "compare_price": 1999.0,
        "category": "Party Wear",
        "fabric": "Tulle & Satin",
        "size_options": ALL_SIZES,
        "colors": ["Pink", "White", "Lavender", "Blue"],
        "images": ["/images/placeholder-party.jpg"],
        "stock": 45,
        "sku": "PW-002",
        "is_featured": True,
    },
    {
        "name": "Velvet Festive Party Frock",
        "description": "Rich velvet party frock with lace overlay and ribbon waistband. Elegant and comfortable — perfect for Christmas, New Year and festive family gatherings.",
        "price": 1299.0,
        "compare_price": 1799.0,
        "category": "Party Wear",
        "fabric": "Velvet",
        "size_options": ALL_SIZES,
        "colors": ["Red", "Emerald Green", "Navy Blue"],
        "images": ["/images/placeholder-party.jpg"],
        "stock": 40,
        "sku": "PW-003",
        "is_featured": False,
    },
    {
        "name": "Floral Organza Party Gown",
        "description": "Dreamy organza party gown with 3D floral applique on the bodice. Flared skirt with soft lining. A show-stopper at any party or wedding.",
        "price": 2199.0,
        "compare_price": 2999.0,
        "category": "Party Wear",
        "fabric": "Organza",
        "size_options": ALL_SIZES,
        "colors": ["Pink", "White", "Peach"],
        "images": ["/images/placeholder-party.jpg"],
        "stock": 25,
        "sku": "PW-004",
        "is_featured": True,
    },
]


def seed():
    db = SessionLocal()
    try:
        admin_email = os.getenv("ADMIN_EMAIL", "kumaragurubaran27102@gmail.com")
        admin_password = os.getenv("ADMIN_PASSWORD", "Admin@123456")

        existing_admin = db.query(models.User).filter(models.User.email == admin_email).first()
        if not existing_admin:
            admin = models.User(
                full_name="Vijey Textile Admin",
                email=admin_email,
                phone="9994168839",
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
