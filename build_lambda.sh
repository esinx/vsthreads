cd ./backend;
pip install -r requirements.txt --platform manylinux2014_x86_64 --python-version 3.11.8 --only-binary=:all: --upgrade -t vendor;
zip -r ../backend.zip ./;
cd ../;