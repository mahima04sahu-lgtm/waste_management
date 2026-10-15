import io
import base64
import logging
import math
from PIL import Image
import numpy as np

logger = logging.getLogger(__name__)

# Classes that must NEVER be classified as waste (Humans, furniture, room fixtures, laptop webcam host)
IGNORED_CLASSES = {
    'person', 'chair', 'couch', 'sofa', 'bed', 'dining table', 'tv', 'tvmonitor',
    'laptop', 'window', 'door', 'wall', 'potted plant', 'curtain', 'bench', 
    'backpack', 'handbag', 'tie', 'suitcase', 'sink', 'toilet', 'refrigerator'
}

# Explicit Waste Classification & Worker Guidance Mapping
WASTE_CATEGORY_MAP = {
    # --- DRY / RECYCLABLE WASTE ---
    'bottle': {
        'category': 'DRY',
        'label': 'Plastic / Glass Bottle',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🍾',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Recyclable container. Safe for normal transfer into Dry compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'cup': {
        'category': 'DRY',
        'label': 'Paper / Plastic Cup',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🥤',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Non-hazardous dry beverage container. Empty liquid residue & dispose in Dry stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'can': {
        'category': 'DRY',
        'label': 'Aluminum / Tin Can',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🥫',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Metal recyclable. Deposit in Dry compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'bowl': {
        'category': 'DRY',
        'label': 'Plastic / Ceramic Bowl',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🥣',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Dry solid waste. Deposit in Dry compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'box': {
        'category': 'DRY',
        'label': 'Cardboard Packaging',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '📦',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Clean paper / cardboard recyclable. Flatten if possible.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'book': {
        'category': 'DRY',
        'label': 'Paper / Notebook',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '📚',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Clean paper recyclable. Transfer to Dry compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'wine glass': {
        'category': 'DRY',
        'label': 'Glass Container',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🍷',
        'ppe': ['Thick Work Gloves'],
        'guideline': 'Fragile glassware. Transfer gently to prevent breakage.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'cell phone': {
        'category': 'DRY',
        'label': 'Electronic Device (E-Waste)',
        'bin_name': 'E-Waste / Specialist Bin',
        'bin_color': '#7c3aed',
        'icon': '📱',
        'ppe': ['Antistatic / Standard Gloves'],
        'guideline': 'Contains lithium-ion battery. Separate into Dedicated E-Waste collection.',
        'risk_level': 'MEDIUM',
        'hazard_flag': False
    },
    'mouse': {
        'category': 'DRY',
        'label': 'Computer Peripheral (E-Waste)',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🖱️',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Small electronic peripheral. Deposit in E-Waste/Dry stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'keyboard': {
        'category': 'DRY',
        'label': 'Computer Keyboard (E-Waste)',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '⌨️',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Electronic peripheral. Deposit in dry / e-waste stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'remote': {
        'category': 'DRY',
        'label': 'Plastic Remote (E-Waste)',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '📺',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Remove dry cell batteries before depositing in dry stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'fork': {
        'category': 'DRY',
        'label': 'Disposable Cutlery (Fork)',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🍴',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Dry plastic cutlery. Place in Dry stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'spoon': {
        'category': 'DRY',
        'label': 'Disposable Cutlery (Spoon)',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🥄',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Dry plastic cutlery. Place in Dry stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'toothbrush': {
        'category': 'DRY',
        'label': 'Plastic Toothbrush',
        'bin_name': 'Blue / Dry Waste Compartment',
        'bin_color': '#0284c7',
        'icon': '🪥',
        'ppe': ['Standard Nitrile Gloves'],
        'guideline': 'Solid plastic item. Deposit in Dry Waste.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },

    # --- WET / ORGANIC FOOD WASTE ---
    'banana': {
        'category': 'WET',
        'label': 'Banana Peel / Fruit Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍌',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Rapidly biodegradable organic waste. Transfer immediately to Wet stream.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'apple': {
        'category': 'WET',
        'label': 'Apple Core / Fruit Residue',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍎',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Biodegradable fruit scrap. Deposit in Green Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'orange': {
        'category': 'WET',
        'label': 'Citrus Peel / Food Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍊',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Biodegradable organic waste. Deposit in Green Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'sandwich': {
        'category': 'WET',
        'label': 'Bread / Prepared Food Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🥪',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Decomposing food waste. Deposit in Green Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'broccoli': {
        'category': 'WET',
        'label': 'Vegetable Residue',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🥦',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Organic kitchen / cafeteria residue. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'carrot': {
        'category': 'WET',
        'label': 'Vegetable Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🥕',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Organic food scrap. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'pizza': {
        'category': 'WET',
        'label': 'Cooked Food Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍕',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Perishable food scrap. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'donut': {
        'category': 'WET',
        'label': 'Bakery / Food Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍩',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Perishable organic waste. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'cake': {
        'category': 'WET',
        'label': 'Bakery / Food Scrap',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🍰',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Perishable organic waste. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },
    'hot dog': {
        'category': 'WET',
        'label': 'Food Residue',
        'bin_name': 'Green / Wet Organic Compartment',
        'bin_color': '#16a34a',
        'icon': '🌭',
        'ppe': ['Waterproof Sanitation Gloves'],
        'guideline': 'Perishable food scrap. Deposit in Wet compartment.',
        'risk_level': 'LOW',
        'hazard_flag': False
    },

    # --- HAZARD / BIOHAZARD / SHARPS ---
    'scissors': {
        'category': 'HAZARD',
        'label': 'Sharps / Surgical Scissors',
        'bin_name': 'Yellow Puncture-Proof Sharps Bin',
        'bin_color': '#dc2626',
        'icon': '✂️',
        'ppe': ['Heavy Puncture-Resistant Nitrile Gloves', 'Safety Goggles'],
        'guideline': '⚠️ SHARPS INJURY HAZARD. Never compress or touch blade directly. Deposit in puncture-proof bin.',
        'risk_level': 'HIGH',
        'hazard_flag': True
    },
    'knife': {
        'category': 'HAZARD',
        'label': 'Sharp Blade / Scalpel',
        'bin_name': 'Yellow Puncture-Proof Sharps Bin',
        'bin_color': '#dc2626',
        'icon': '🔪',
        'ppe': ['Heavy Cut-Resistant Gloves', 'Safety Tongs'],
        'guideline': '⚠️ SHARPS HAZARD. Transfer using mechanical tongs into designated sharps container.',
        'risk_level': 'HIGH',
        'hazard_flag': True
    },
    'syringe': {
        'category': 'HAZARD',
        'label': 'Medical Syringe / Needle',
        'bin_name': 'Yellow Biohazard Sharps Container',
        'bin_color': '#dc2626',
        'icon': '💉',
        'ppe': ['Medical-Grade Nitrile Gloves', 'Forceps / Mechanical Tongs', 'Face Shield'],
        'guideline': '🚨 BIOHAZARD WARNING! Potential bloodborne pathogen risk. Never recap needle. Deposit in Yellow Sharps Bin.',
        'risk_level': 'CRITICAL',
        'hazard_flag': True
    }
}

class WasteScannerService:
    _model = None

    @classmethod
    def get_model(cls):
        """Loads YOLOv8 Nano model lazily on first call."""
        if cls._model is None:
            try:
                from ultralytics import YOLO
                logger.info("Initializing YOLOv8 Nano model for WasteGuard...")
                cls._model = YOLO('yolov8n.pt')
                logger.info("YOLOv8 Nano model loaded successfully.")
            except Exception as e:
                logger.warning(f"Could not load YOLOv8 model: {e}")
        return cls._model

    @classmethod
    def decode_image(cls, image_data):
        """Decodes base64 string or file input into a PIL Image."""
        if isinstance(image_data, str):
            if ',' in image_data:
                image_data = image_data.split(',')[1]
            image_bytes = base64.b64decode(image_data)
            return Image.open(io.BytesIO(image_bytes)).convert('RGB')
        elif hasattr(image_data, 'read'):
            return Image.open(image_data).convert('RGB')
        raise ValueError("Unsupported image format")

    @classmethod
    def analyze_frame(cls, image_input, conf_threshold=0.20):
        """
        Runs object detection, filters out humans and background furniture,
        prioritizes objects held in hand near the center reticle, and returns:
        - Detected waste items with bounding boxes
        - Waste Category (DRY, WET, HAZARD)
        - Confidence score & Worker Safety Protocol
        """
        pil_img = cls.decode_image(image_input)
        img_w, img_h = pil_img.size
        center_x = img_w / 2.0
        center_y = img_h / 2.0
        max_dist = math.sqrt(center_x ** 2 + center_y ** 2)

        model = cls.get_model()
        candidates = []

        if model is not None:
            try:
                results = model.predict(source=pil_img, conf=conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0])
                        class_name = model.names[cls_id].lower().strip()
                        conf = float(box.conf[0]) * 100.0
                        xyxy = [round(float(c), 1) for c in box.xyxy[0]]

                        # 1. CRITICAL: IGNORE HUMANS & BACKGROUND FURNITURE
                        if class_name in IGNORED_CLASSES:
                            logger.info(f"Ignoring non-waste background class: {class_name}")
                            continue

                        # 2. Check box area: Ignore giant boxes covering > 85% of frame (background walls/fixtures)
                        box_w = max(1.0, xyxy[2] - xyxy[0])
                        box_h = max(1.0, xyxy[3] - xyxy[1])
                        area_ratio = (box_w * box_h) / (img_w * img_h)
                        if area_ratio > 0.85:
                            continue

                        # 3. Calculate distance from center (hand-held item priority)
                        box_cx = (xyxy[0] + xyxy[2]) / 2.0
                        box_cy = (xyxy[1] + xyxy[3]) / 2.0
                        dist_from_center = math.sqrt((box_cx - center_x) ** 2 + (box_cy - center_y) ** 2)
                        center_weight = max(0.2, 1.0 - (dist_from_center / max_dist))

                        # Known waste mapping or generic dry recyclable
                        waste_info = WASTE_CATEGORY_MAP.get(class_name)
                        if not waste_info:
                            waste_info = {
                                'category': 'DRY',
                                'label': class_name.title(),
                                'bin_name': 'Blue / Dry Waste Compartment',
                                'bin_color': '#0284c7',
                                'icon': '📦',
                                'ppe': ['Standard Nitrile Gloves'],
                                'guideline': f'Identified as {class_name.title()}. Deposit in standard Dry compartment.',
                                'risk_level': 'LOW',
                                'hazard_flag': False
                            }

                        # Priority score: confidence * center_weight, boosted if Hazard
                        priority_score = conf * center_weight
                        if waste_info.get('hazard_flag'):
                            priority_score += 50.0 # Prioritize hazards immediately

                        candidates.append({
                            'class_name': class_name,
                            'label': waste_info['label'],
                            'category': waste_info['category'],
                            'confidence': round(conf, 1),
                            'priority_score': priority_score,
                            'box': xyxy,
                            'box_normalized': [
                                round(xyxy[0] / img_w, 3),
                                round(xyxy[1] / img_h, 3),
                                round(xyxy[2] / img_w, 3),
                                round(xyxy[3] / img_h, 3)
                            ],
                            'icon': waste_info['icon'],
                            'color': waste_info['bin_color'],
                            'bin_name': waste_info['bin_name'],
                            'guideline': waste_info['guideline'],
                            'ppe': waste_info['ppe'],
                            'hazard_flag': waste_info.get('hazard_flag', False)
                        })
            except Exception as e:
                logger.error(f"Error during YOLO prediction: {e}")

        # If NO valid waste object was detected (only person in room, or empty frame)
        if not candidates:
            return {
                'success': True,
                'detected': False,
                'primary_category': 'NONE',
                'confidence': 0.0,
                'primary_label': 'No Waste Item in Hand',
                'icon': '🖐️',
                'target_bin': {
                    'name': 'Hold Waste Item in Hand Inside Frame',
                    'color': '#64748b',
                    'icon': '🎯'
                },
                'safety_protocol': {
                    'ppe_required': ['Standard Work Gloves'],
                    'handling_guideline': 'Worker detected. Hold an object (bottle, cup, paper, food scrap, scissors) in front of the camera inside the target box.',
                    'action_code': 'AWAITING_OBJECT',
                    'is_hazard': False
                },
                'detections': [],
                'item_count': 0,
                'image_size': {'width': img_w, 'height': img_h}
            }

        # Sort candidates by priority score (highest score first)
        candidates.sort(key=lambda c: c['priority_score'], reverse=True)
        primary_item = candidates[0]
        has_hazard = any(c['hazard_flag'] for c in candidates)

        # If any candidate is hazard, escalate overall category
        overall_category = 'HAZARD' if has_hazard else primary_item['category']

        return {
            'success': True,
            'detected': True,
            'primary_category': overall_category,
            'confidence': primary_item['confidence'],
            'primary_label': primary_item['label'],
            'icon': primary_item['icon'],
            'target_bin': {
                'name': primary_item['bin_name'],
                'color': primary_item['color'],
                'icon': primary_item['icon']
            },
            'safety_protocol': {
                'ppe_required': primary_item['ppe'],
                'handling_guideline': primary_item['guideline'],
                'action_code': 'ISOLATE_SHARPS' if overall_category == 'HAZARD' else 'NORMAL_TRANSFER',
                'is_hazard': has_hazard
            },
            'detections': candidates,
            'item_count': len(candidates),
            'image_size': {'width': img_w, 'height': img_h}
        }
