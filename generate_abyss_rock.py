import random
import math
from PIL import Image, ImageDraw

def generate_abyss_rock():
    width, height = 128, 128
    BG = (0, 0, 0, 0)
    
    # Color palette - pixel art style
    SHELL_DARK = (25, 8, 8, 255)      # Very dark gray-red
    SHELL_MID = (45, 15, 15, 255)     # Dark gray-red
    CORE_BLACK = (30, 0, 0, 255)      # Almost black
    CORE_DARK = (100, 0, 0, 255)      # Dark red
    CORE_MID = (180, 10, 10, 255)     # Medium red
    CORE_BRIGHT = (255, 30, 30, 255)  # Bright red
    CORE_INTENSE = (255, 60, 60, 255) # Intense red pulse
    NEON_EDGE = (220, 20, 60, 255)    # Crimson neon
    NEON_BRIGHT = (255, 40, 80, 255)  # Brighter crimson
    
    img = Image.new("RGBA", (width, height), BG)
    
    center = (64, 64)
    radius = 48
    
    # Generate irregular jagged outline
    def get_chaotic_points(center, r, count=24):
        pts = []
        for i in range(count):
            angle = (i / count) * 2 * math.pi
            # Add hexagon influence for socket fit
            hex_mod = 0.85 + 0.15 * abs(math.cos(angle * 6))
            # Random jaggedness - craters, chips, rough edges
            chaos = random.uniform(0.65, 1.15)
            curr_r = r * hex_mod * chaos
            x = center[0] + curr_r * math.cos(angle)
            y = center[1] + curr_r * math.sin(angle)
            pts.append((int(x), int(y)))
        return pts
    
    rock_outline = get_chaotic_points(center, radius)
    
    # Create mask for the rock silhouette
    mask = Image.new("L", (width, height), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.polygon(rock_outline, fill=255)
    
    # Create working layer
    layer = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(layer)
    
    # === CORE: Chaotic fire-like energy patterns ===
    # Use chunky pixels for retro look
    for y in range(0, height, 2):  # 2x2 pixel chunks
        for x in range(0, width, 2):
            dx = x - center[0]
            dy = y - center[1]
            dist = math.sqrt(dx*dx + dy*dy)
            
            if dist < radius * 0.95:
                # Create chaotic patterns using noise-like function
                angle = math.atan2(dy, dx)
                noise = (math.sin(x * 0.3 + y * 0.2) + math.cos(x * 0.2 - y * 0.3)) * 0.5
                pulse = abs(math.sin(angle * 3 + dist * 0.1))
                
                # Mix random and pattern-based chaos
                chaos_val = (noise + pulse + random.random()) / 3
                
                # Choose color based on chaos value
                if chaos_val > 0.85:
                    c = CORE_INTENSE
                elif chaos_val > 0.7:
                    c = CORE_BRIGHT
                elif chaos_val > 0.45:
                    c = CORE_MID
                elif chaos_val > 0.25:
                    c = CORE_DARK
                else:
                    c = CORE_BLACK
                
                # Draw 2x2 pixel block
                draw.rectangle([x, y, x+1, y+1], fill=c)
    
    # === THIN SHELL with translucent cracks ===
    # Draw shell only near edges
    shell_points = []
    for px, py in rock_outline:
        # Shell thickness: very thin, only 4-8 pixels inward
        shell_thickness = random.randint(4, 8)
        angle = math.atan2(py - center[1], px - center[0])
        
        # Draw shell segments
        for t in range(shell_thickness):
            sx = px - t * math.cos(angle)
            sy = py - t * math.sin(angle)
            
            if 0 <= sx < width and 0 <= sy < height:
                # Add variation to shell
                if random.random() > 0.3:  # 70% coverage - cracks show through
                    shell_color = SHELL_DARK if random.random() > 0.3 else SHELL_MID
                    draw.point((int(sx), int(sy)), fill=shell_color)
    
    # === CRACKS - bright energy showing through ===
    for _ in range(15):
        # Random crack from center radiating outward
        crack_angle = random.random() * 2 * math.pi
        crack_length = radius * random.uniform(0.6, 1.2)
        
        cx, cy = center[0] + random.randint(-15, 15), center[1] + random.randint(-15, 15)
        
        for i in range(12):
            step = crack_length / 12
            nx = cx + (math.cos(crack_angle) * step * i) + random.randint(-3, 3)
            ny = cy + (math.sin(crack_angle) * step * i) + random.randint(-3, 3)
            
            # Bright cracks
            if i % 2 == 0:  # Chunky pixels
                draw.point((int(nx), int(ny)), fill=CORE_BRIGHT)
                if random.random() > 0.5:
                    draw.point((int(nx)+1, int(ny)), fill=CORE_INTENSE)
    
    # === CRATERS - chipped areas ===
    for _ in range(8):
        crater_x = random.randint(30, 98)
        crater_y = random.randint(30, 98)
        crater_size = random.randint(3, 8)
        
        draw.ellipse(
            [crater_x - crater_size, crater_y - crater_size, 
             crater_x + crater_size, crater_y + crater_size],
            fill=CORE_BLACK,
            outline=SHELL_DARK
        )
    
    # === INTENSE CRIMSON NEON EDGE GLOW ===
    # Multi-layer edge glow for intensity
    for offset in [0, -1, -2]:
        glow_points = []
        for px, py in rock_outline:
            if offset == 0:
                glow_points.append((px, py))
            else:
                # Inward offset
                angle = math.atan2(py - center[1], px - center[0])
                gx = px + offset * math.cos(angle)
                gy = py + offset * math.sin(angle)
                glow_points.append((int(gx), int(gy)))
        
        glow_color = NEON_BRIGHT if offset == 0 else NEON_EDGE
        draw.polygon(glow_points, outline=glow_color)
    
    # Apply mask - clip everything to silhouette
    img.paste(layer, (0, 0), mask=mask)
    
    # Save
    img.save("abyss_meteorite_6.png")
    print("Abyss meteorite generated with chaotic energy core!")

if __name__ == "__main__":
    generate_abyss_rock()
