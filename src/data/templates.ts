export type TemplateNode = {
  question_text: string   // button label (max 20 chars)
  answer_text: string     // bot reply
  children?: { question_text: string; answer_text: string }[]
}

export type Template = {
  id: string
  name: string
  industry: string
  emoji: string
  description: string
  greeting: string
  farewell: string
  nodes: TemplateNode[]
}

export const TEMPLATES: Template[] = [
  {
    id: 'restaurant',
    name: 'Restaurant',
    industry: 'Food & Beverage',
    emoji: '🍽️',
    description: 'Perfect for restaurants, cafes, and food delivery businesses.',
    greeting: "Welcome to our restaurant! 🍽️\n\nWe're delighted to have you. How can we help you today?\n\nPlease select an option below to get started.",
    farewell: "Thank you for visiting us! 🙏\n\nWe hope to serve you soon. Have a wonderful day! ✨",
    nodes: [
      {
        question_text: 'View Menu',
        answer_text: "Here's our menu overview 📋\n\nWe offer a wide range of delicious dishes. Please select a category:",
        children: [
          { question_text: 'Starters', answer_text: "🥗 Our Starters:\n\n• Veg Spring Rolls - ₹180\n• Paneer Tikka - ₹280\n• Chicken Wings - ₹320\n• Soup of the Day - ₹150\n\nAll starters are freshly prepared. Place your order by calling us!" },
          { question_text: 'Main Course', answer_text: "🍛 Main Course:\n\n• Dal Makhani - ₹220\n• Butter Chicken - ₹380\n• Paneer Butter Masala - ₹320\n• Biryani (Veg/Chicken) - ₹280/₹380\n\nAll mains come with rice or roti." },
          { question_text: 'Desserts', answer_text: "🍮 Desserts:\n\n• Gulab Jamun - ₹120\n• Ice Cream (3 scoops) - ₹180\n• Kheer - ₹150\n• Brownie with Ice Cream - ₹220\n\nSave room for something sweet! 😊" },
        ],
      },
      {
        question_text: 'Timings & Info',
        answer_text: "🕐 We Are Open:\n\nMonday – Sunday\n12:00 PM – 11:00 PM\n\n📞 Reservations: +91 XXXXX XXXXX\n🚗 Parking: Available\n💳 Cards & UPI accepted\n\nKitchen closes at 10:30 PM.",
      },
      {
        question_text: 'Reserve a Table',
        answer_text: "🪑 Table Reservations:\n\nTo reserve a table, please call us at:\n📞 +91 XXXXX XXXXX\n\nOr WhatsApp us with:\n• Date & Time\n• Number of guests\n• Any special requests\n\nWe look forward to hosting you! 🎉",
      },
    ],
  },
  {
    id: 'salon',
    name: 'Salon & Spa',
    industry: 'Beauty & Wellness',
    emoji: '💇',
    description: 'For salons, spas, and beauty parlours.',
    greeting: "Welcome to our Salon! 💇‍♀️✨\n\nLook good, feel great! How can we help you today?\n\nPlease select an option below:",
    farewell: "Thank you for choosing us! 💖\n\nWe can't wait to see you. Have a beautiful day! ✨",
    nodes: [
      {
        question_text: 'Our Services',
        answer_text: "💅 Our Services:\n\nWe offer a range of premium beauty treatments. Please choose a category:",
        children: [
          { question_text: 'Hair Services', answer_text: "💇 Hair Services:\n\n• Haircut (Ladies) - ₹300\n• Haircut (Gents) - ₹150\n• Hair Colour - ₹800+\n• Smoothening - ₹2500+\n• Keratin Treatment - ₹3000+\n\nPrices may vary. Call to confirm." },
          { question_text: 'Skin & Facial', answer_text: "✨ Skin Treatments:\n\n• Basic Facial - ₹500\n• Cleanup - ₹350\n• De-tan Treatment - ₹600\n• Anti-Acne Facial - ₹800\n• Gold Facial - ₹1200\n\nAll products are dermatologist-tested." },
          { question_text: 'Nail Art', answer_text: "💅 Nail Services:\n\n• Manicure - ₹400\n• Pedicure - ₹500\n• Gel Nails - ₹800\n• Nail Art (per nail) - ₹50+\n• Nail Extensions - ₹1500\n\nBook in advance to avoid wait time!" },
        ],
      },
      {
        question_text: 'Book Appointment',
        answer_text: "📅 Book an Appointment:\n\nTo schedule your visit, please call or WhatsApp:\n📞 +91 XXXXX XXXXX\n\nShare:\n• Preferred date & time\n• Service you need\n• Your name\n\nWalk-ins welcome based on availability! 🙏",
      },
      {
        question_text: 'Timings & Location',
        answer_text: "📍 Find Us:\n\n[Your Salon Address Here]\n\n🕐 Open: Tuesday – Sunday\n10:00 AM – 8:00 PM\n(Closed on Mondays)\n\n📞 +91 XXXXX XXXXX\n💳 All payment modes accepted",
      },
    ],
  },
  {
    id: 'realestate',
    name: 'Real Estate',
    industry: 'Property',
    emoji: '🏠',
    description: 'For real estate agents, builders, and property firms.',
    greeting: "Welcome to [Your Agency]! 🏠\n\nYour dream property is just a click away. How can we help you today?",
    farewell: "Thank you for your interest! 🙏\n\nOur agent will reach out to you shortly. Have a great day! 🏡",
    nodes: [
      {
        question_text: 'Buy Property',
        answer_text: "🏠 Properties For Sale:\n\nWe have a wide range of properties. Select a type:",
        children: [
          { question_text: 'Apartments', answer_text: "🏢 Apartments For Sale:\n\n• 1 BHK – ₹35–50 Lakhs\n• 2 BHK – ₹55–85 Lakhs\n• 3 BHK – ₹90L–1.5 Cr\n• 4 BHK Luxury – ₹2 Cr+\n\nAll units are RERA registered. Call for site visits!" },
          { question_text: 'Villas & Plots', answer_text: "🏡 Villas & Plots:\n\n• Plots – ₹20L+ (starts 1000 sqft)\n• Independent Villas – ₹80L+\n• Gated Community Villas – ₹1.5 Cr+\n\nEMI options available. Call our agent today!" },
        ],
      },
      {
        question_text: 'Rent Property',
        answer_text: "🔑 Rentals Available:\n\n• 1 BHK – ₹8,000–15,000/mo\n• 2 BHK – ₹15,000–30,000/mo\n• 3 BHK – ₹25,000–50,000/mo\n• Commercial Spaces – ₹30,000+/mo\n\nAll listings are verified. Zero brokerage options available! 📞 Call us to schedule a visit.",
      },
      {
        question_text: 'Sell My Property',
        answer_text: "💰 Sell Your Property:\n\nWe help you get the best price for your property!\n\n✅ Free property valuation\n✅ Wide buyer network\n✅ Legal assistance\n✅ Quick closures\n\nShare your property details and we'll reach out within 24 hours. 📞 +91 XXXXX XXXXX",
      },
      {
        question_text: 'Talk to Agent',
        answer_text: "👨‍💼 Speak to an Agent:\n\nOur property experts are available:\n🕐 Mon–Sat: 9 AM – 7 PM\n\n📞 Call: +91 XXXXX XXXXX\n📧 Email: info@youragency.com\n\nFor urgent queries, WhatsApp us directly!",
      },
    ],
  },
  {
    id: 'clinic',
    name: 'Clinic / Doctor',
    industry: 'Healthcare',
    emoji: '🏥',
    description: 'For clinics and doctors with automated WhatsApp appointment booking.',
    greeting: "Welcome to [Clinic Name]! 🏥\n\nYour health is our priority. We offer *instant appointment booking* right here on WhatsApp — no calls needed!\n\nHow can we help you today?",
    farewell: "Thank you for reaching out to [Clinic Name]! 🙏\n\nWe look forward to seeing you at your appointment. Take care and stay healthy! 💊\n\nType *Hi* anytime to book a new appointment.",
    nodes: [
      {
        question_text: 'Book Appointment',
        answer_text: "📅 *Book Your Appointment Instantly!*\n\nOur WhatsApp booking system will guide you step by step:\n\n1️⃣ Share your name\n2️⃣ Your age\n3️⃣ Select your gender\n4️⃣ Choose your health concern\n5️⃣ Pick an available slot\n\n✅ *Confirmed instantly — no waiting!*\n\nType *Hi* to start booking your appointment now.",
      },
      {
        question_text: 'Our Specialities',
        answer_text: "🩺 *Our Specialities:*\n\nWe provide expert care across a wide range of conditions:\n\n• 🫀 Cardiology\n• 🦴 Orthopaedics\n• 🧠 Neurology\n• 👶 Paediatrics\n• 🌸 Gynaecology\n• 🔬 General Medicine\n• 🩸 Diabetes & Thyroid\n• 🫁 Pulmonology\n\nType *Hi* to book a consultation with our specialists.",
      },
      {
        question_text: 'Timings & Location',
        answer_text: "📍 *Find Us:*\n\n[Clinic Address Here]\n\n🕐 *Clinic Hours:*\nMon – Sat: 9:00 AM – 1:00 PM & 5:00 PM – 8:00 PM\nSunday: 10:00 AM – 1:00 PM\n\n📞 Reception: +91 XXXXX XXXXX\n🅿️ Free parking available\n💳 All payment modes accepted\n\n📌 *[Google Maps Link Here]*",
      },
      {
        question_text: 'Emergency',
        answer_text: "🚨 *Emergency Contact:*\n\n📞 24/7 Emergency Helpline:\n*+91 XXXXX XXXXX*\n\nPlease reach us directly for emergencies — do not use the chatbot for urgent medical situations.\n\n🚑 For life-threatening emergencies, call *108* immediately.\n\n🏥 Nearest Hospital:\n[Hospital Name & Address]",
      },
    ],
  },
  {
    id: 'ecommerce',
    name: 'E-Commerce',
    industry: 'Online Store',
    emoji: '🛍️',
    description: 'For online stores, D2C brands, and product businesses.',
    greeting: "Welcome to [Your Store]! 🛍️\n\nDiscover amazing products at great prices. How can we help you today?",
    farewell: "Thank you for shopping with us! 🛒\n\nYour satisfaction is our priority. Happy shopping! ✨",
    nodes: [
      {
        question_text: 'Shop Products',
        answer_text: "🛍️ Browse Our Collection:\n\nWhat are you looking for?",
        children: [
          { question_text: 'New Arrivals', answer_text: "✨ New Arrivals:\n\nOur latest products are live on our website!\n\n🌐 Shop now: [your-website.com]\n\nUse code WELCOME10 for 10% off your first order! 🎉" },
          { question_text: 'Best Sellers', answer_text: "🔥 Best Sellers:\n\nOur most loved products:\n\n1. [Product Name] – ₹XXX\n2. [Product Name] – ₹XXX\n3. [Product Name] – ₹XXX\n\nVisit our website for the full catalogue!" },
        ],
      },
      {
        question_text: 'Track My Order',
        answer_text: "📦 Track Your Order:\n\nTo track your order, visit:\n🌐 [your-website.com/track]\n\nOr share your Order ID here and our team will update you within 2 hours.\n\n📞 Support: +91 XXXXX XXXXX",
      },
      {
        question_text: 'Returns & Refunds',
        answer_text: "🔄 Returns & Refunds Policy:\n\n✅ 7-day easy returns\n✅ Free pickup from your door\n✅ Refund within 5–7 business days\n\nTo initiate a return, share:\n• Order ID\n• Reason for return\n• Photos (if damaged)\n\n📞 +91 XXXXX XXXXX",
      },
      {
        question_text: 'Contact Support',
        answer_text: "🎧 Customer Support:\n\n📞 Call/WhatsApp: +91 XXXXX XXXXX\n📧 Email: support@yourstore.com\n\n🕐 Support Hours:\nMon–Sat: 10 AM – 7 PM\n\nAverage response time: under 2 hours ⚡",
      },
    ],
  },
  {
    id: 'general',
    name: 'General Business',
    industry: 'Any Business',
    emoji: '🏢',
    description: 'A clean, general-purpose template for any business.',
    greeting: "Welcome to [Your Business]! 👋\n\nWe're here to help you 24/7. Please select an option below to get started.",
    farewell: "Thank you for contacting us! 🙏\n\nWe appreciate your time. Have a wonderful day! ✨",
    nodes: [
      {
        question_text: 'Our Services',
        answer_text: "🌟 Our Services:\n\n[Describe your key services here]\n\nWe provide top-quality service tailored to your needs. Call us to learn more!\n\n📞 +91 XXXXX XXXXX",
      },
      {
        question_text: 'Pricing',
        answer_text: "💰 Our Pricing:\n\n[Add your pricing details here]\n\nAll plans include:\n✅ [Feature 1]\n✅ [Feature 2]\n✅ [Feature 3]\n\nContact us for custom quotes!",
      },
      {
        question_text: 'About Us',
        answer_text: "🏢 About Us:\n\n[Your company story here]\n\nFounded with a mission to [your mission], we've been serving customers since [year].\n\n⭐ [Your key achievement or USP]",
      },
      {
        question_text: 'Contact Us',
        answer_text: "📞 Get In Touch:\n\n📞 Phone: +91 XXXXX XXXXX\n📧 Email: info@yourbusiness.com\n📍 Address: [Your Address]\n\n🕐 Working Hours:\nMon–Sat: 9 AM – 6 PM\n\nWe typically respond within 1 hour! ⚡",
      },
    ],
  },
]
