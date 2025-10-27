import os
from PIL import Image, ImageDraw, ImageFont
import math

def create_icon(size):
    # Create a new image with transparent background
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw background gradient (simplified as solid color)
    draw.rectangle([0, 0, size, size], fill=(74, 144, 226, 255))

    # Draw border
    draw.rectangle([0, 0, size-1, size-1], outline=(46, 92, 138, 255), width=max(1, size//32))

    # Calculate center and padding
    center_x = size / 2
    center_y = size / 2
    padding = size * 0.2

    # Draw bat wings (simplified)
    # Left wing
    points_left = [
        (padding, center_y),
        (center_x - padding/2, center_y - padding/2),
        (center_x, center_y),
        (center_x - padding/2, center_y + padding/2),
        (padding, center_y)
    ]
    draw.polygon(points_left, fill=(255, 255, 255, 255))

    # Right wing
    points_right = [
        (size - padding, center_y),
        (center_x + padding/2, center_y - padding/2),
        (center_x, center_y),
        (center_x + padding/2, center_y + padding/2),
        (size - padding, center_y)
    ]
    draw.polygon(points_right, fill=(255, 255, 255, 255))

    # Draw center circle
    circle_radius = size * 0.15
    circle_left = center_x - circle_radius
    circle_top = center_y - circle_radius
    circle_right = center_x + circle_radius
    circle_bottom = center_y + circle_radius
    draw.ellipse([circle_left, circle_top, circle_right, circle_bottom],
                 fill=(255, 215, 0, 255))

    # Add text for larger icons
    if size >= 48:
        try:
            # Try to use a font
            font_size = int(size * 0.25)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            # Use default font if arial is not available
            font = ImageFont.load_default()

        # Draw "WS" text
        text = "WS"
        if size >= 48:
            text_width = draw.textlength(text, font=font)
            text_x = center_x - text_width / 2
            text_y = center_y - font_size / 2
            draw.text((text_x, text_y), text, fill=(255, 255, 255, 255), font=font)

    # Save the image
    img.save(f'icon{size}.png', 'PNG')
    print(f'Created icon{size}.png')

# Create all three sizes
if __name__ == "__main__":
    try:
        create_icon(16)
        create_icon(48)
        create_icon(128)
        print("\nAll icons created successfully!")
    except ImportError:
        print("PIL (Pillow) library not found. Installing...")
        os.system("pip install Pillow")
        print("\nPlease run the script again after installation.")
    except Exception as e:
        print(f"Error creating icons: {e}")