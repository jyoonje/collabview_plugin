import sys
import os
import shutil
import logging
import subprocess
from logging.handlers import TimedRotatingFileHandler
import base64
import requests
from PIL import Image
from msoffice2pdf import convert
import ghostscript
import re
from config import GOTENBERG_URL

Image.MAX_IMAGE_PIXELS = None
MAX_PIXELS = 100000000

# 로그 디렉토리 확인 및 생성
log_dir = 'public/web/log'
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# TimedRotatingFileHandler 설정
log_filename = os.path.join(log_dir, 'convert.log')
handler = TimedRotatingFileHandler(log_filename, when='midnight', interval=1, backupCount=30)
handler.suffix = "%Y-%m-%d"
handler.extMatch = re.compile(r"^\d{4}-\d{2}-\d{2}$")  # 수정된 부분

logging.basicConfig(
    handlers=[handler],
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.pdf', '.ps']

def base64_encode(filename):
    return base64.urlsafe_b64encode(filename.encode('utf-8')).decode('utf-8')

def base64_decode(encoded_filename):
    return base64.urlsafe_b64decode(encoded_filename.encode('utf-8')).decode('utf-8')

def safe_move(src, dst):
    try:
        shutil.move(src, dst)
        logging.info(f"Moved file from {src} to {dst}")
    except FileNotFoundError as e:
        logging.error(f"Error moving file: {e}")
        raise

def ps_to_pdf(ps_file, pdf_file):
    args = [
        "ps2pdf",
        "-dNOPAUSE",
        "-dBATCH",
        "-dSAFER",
        "-sDEVICE=pdfwrite",
        f"-sOutputFile={pdf_file}",
        ps_file
    ]
    encoding = sys.getfilesystemencoding()
    args = [a.encode(encoding) for a in args]
    ghostscript.Ghostscript(*args)

def convert_using_gotenberg(input_path, output_directory):
    with open(input_path, 'rb') as f:
        files = {'files': (os.path.basename(input_path), f)}
        response = requests.post(GOTENBERG_URL, files=files)
        if response.status_code == 200:
            output_path = os.path.join(output_directory, os.path.basename(input_path).replace(os.path.splitext(input_path)[1], ".pdf"))
            with open(output_path, 'wb') as pdf_file:
                pdf_file.write(response.content)
            logging.info(f"Converted document to PDF using Gotenberg at {output_path}")
            return output_path
        else:
            logging.error(f"Failed to convert document using Gotenberg: {response.text}")
            raise Exception("Gotenberg conversion failed")

def has_esob_files(directory):
    return any(file.endswith('.esob') for file in os.listdir(directory))

def resize_if_needed(input_path, output_path):
    with Image.open(input_path) as img:
        width, height = img.size
        total_pixels = width * height
        logging.debug(f"Original image size: {width}x{height} (Total: {total_pixels} px)")
        if total_pixels > MAX_PIXELS:
            scale_factor = (MAX_PIXELS / total_pixels) ** 0.5
            new_width = int(width * scale_factor)
            new_height = int(height * scale_factor)
            img = img.resize((new_width, new_height), Image.LANCZOS)
            logging.info(f"Resizing: {width}x{height} → {new_width}x{new_height}")
            img.save(output_path)
            return True
        else:
            logging.debug(f"NO CHANGED (within pixel limit)")
            return False

def resize_image(input_path):
    output_path = input_path.replace(".", ".")
    try:
        if resize_if_needed(input_path, output_path):
            return output_path
    except Exception as e:
        logging.error(f"Error resizing image: {e}")
    return input_path

def convert_to_pdf(input_path, fileHash, use_gotenberg=False):
    output_directory = f"public/web/output/{fileHash}"
    if not os.path.exists(output_directory):
        os.makedirs(output_directory)
        logging.info(f"Created output directory {output_directory}")
    else:
        if has_esob_files(output_directory):
            logging.info(f"Found *.esob files in {output_directory}, skipping conversion")
            return

    base, extension = os.path.splitext(input_path)
    filename = os.path.basename(base)
    encoded_filename = base64_encode(filename)
    encoded_input_path = os.path.join(os.path.dirname(input_path), f"{encoded_filename}{extension}")
    notencoded_input_path = os.path.join(os.path.dirname(input_path), f"{filename}{extension}")
    shutil.copy(input_path, encoded_input_path)

    intermediate_output_path = os.path.join(output_directory, f"{encoded_filename}.pdf")

    try:
        if extension.lower() in ['.jpg', '.jpeg', '.png', '.gif']:
            # 리사이징 후 변환 수행
            resized_image_path = resize_image(encoded_input_path)
            image = Image.open(resized_image_path)
            image.convert('RGB').save(intermediate_output_path, format='PDF')
            logging.info(f"Saved image as PDF to {intermediate_output_path}")
        elif extension.lower() in ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']:
            if use_gotenberg:
                # pptx면 prep_zh.py 실행
                if extension.lower() == '.pptx':
                    logging.info(f"Preprocessing {notencoded_input_path} using prep_zh.py for Chinese font reduction")
                    try:
                        subprocess.run([
                            "python",
                            "/home/collabview/public/web/prep_zh.py",
                            notencoded_input_path,
                            notencoded_input_path,
                            "--font_decrement", "150"
                        ], check=True)
                        logging.info("Prep_zh.py completed successfully.")
                    except subprocess.CalledProcessError as e:
                        logging.error(f"Error running prep_zh.py: {e}")
                        return
                # pptx 포함 MS Office 모두 gotenberg 사용
                intermediate_output_path = convert_using_gotenberg(notencoded_input_path, output_directory)
            else:
                # gotenberg를 안 쓸 때 msoffice2pdf
                intermediate_output_path = convert(source=encoded_input_path, output_dir=output_directory, soft=1)
                logging.info(f"Converted document to PDF at {intermediate_output_path}")

        elif extension.lower() == '.pdf':
            intermediate_output_path = encoded_input_path
            logging.info(f"PDF file detected, renaming to .esob")
        elif extension.lower() == '.ps':
            ps_to_pdf(encoded_input_path, intermediate_output_path)
        else:
            logging.error(f"File extension {extension} not supported")
            return

        decoded_output_path = os.path.join(output_directory, f"{filename}.esob")
        if not os.path.exists(intermediate_output_path):
            logging.error(f"Intermediate PDF not found: {intermediate_output_path}")
            return
        safe_move(intermediate_output_path, decoded_output_path)
        logging.info(f"Final file saved as {decoded_output_path}")
    except Exception as e:
        logging.error(f"An unexpected error occurred: {e}", exc_info=True)
    finally:
        os.remove(notencoded_input_path)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        logging.error("Usage: python converter.py input_file [--gotenberg] fileHashVal")
    else:
        print("Starting conversion...")
        logging.info("Starting conversion...")
        input_file = sys.argv[1]
        use_gotenberg = '--gotenberg' in sys.argv
        fileHash = sys.argv[3]
        convert_to_pdf(input_file, fileHash, use_gotenberg)


