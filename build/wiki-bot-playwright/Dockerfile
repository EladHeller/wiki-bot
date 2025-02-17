FROM public.ecr.aws/lambda/nodejs:22

# Install Playwright dependencies (required for Chromium, WebKit, and Firefox)
RUN dnf -y update && \
    dnf -y install \
        libX11 \
        libXcomposite \
        libXcursor \
        libXdamage \
        libXext \
        libXi \
        libXrender \
        libXfixes \
        libXrandr \
        atk \
        gtk3 \
        xz \
        wget \
        alsa-lib \
        glibc-langpack-en \
        ipa-gothic-fonts \
        nss \
        nspr \
        libX11-xcb \
        mesa-dri-drivers \
        mesa-libEGL \
        pango \
        cairo \
        cups-libs \
        dbus-glib \
        libicu \
        libatomic \
        libxslt \
        woff2 \
        opus \
        harfbuzz \
        libjpeg-turbo \
        libwebp \
        enchant2 \
        libsecret \
        hyphen \
        mesa-libGL \
        gudev \
        libevdev \
        libffi \
        mesa-libGLES \
        x264-libs \
    && dnf clean all

# Copy the source code
COPY . .

# Build the project
RUN npm run build && \
    cp ./package.json ./dist/package.json && \
    cp ./package-lock.json ./dist/package-lock.json && \
    cd ./dist && \
    npm --quiet ci --omit=dev --no-bin-links && \
    rm -rf ./package-lock.json ./scripts && \
    cd ..

RUN npx playwright install

# Lambda entrypoint
CMD [ "dist/ironSwords/index.main" ]
