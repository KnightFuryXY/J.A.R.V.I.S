from PIL import Image
import os

def create_ico():
    img_path = "face.png"
    ico_path = "icon.ico"
    
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found.")
        return

    img = Image.open(img_path)
    # Icons can contain multiple sizes
    icon_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    img.save(ico_path, sizes=icon_sizes)
    print(f"Successfully created {ico_path}")

if __name__ == "__main__":
    create_ico()
