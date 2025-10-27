@echo off
echo Creating Chrome extension icons...

:: Use PowerShell to create simple PNG icons
powershell -Command "
Add-Type -AssemblyName System.Drawing;

# Function to create an icon
function Create-Icon($size) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size);
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap);
    $graphics.SmoothingMode = 'AntiAlias';

    # Background gradient
    $rect = New-Object System.Drawing.Rectangle(0, 0, $size, $size);
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect,
        [System.Drawing.Color]::FromArgb(74, 144, 226),
        [System.Drawing.Color]::FromArgb(53, 122, 189),
        [System.Drawing.Drawing2D.LinearGradientMode]::ForwardDiagonal);
    $graphics.FillRectangle($brush, $rect);

    # Draw a simple bat/chat icon
    $padding = $size * 0.2;
    $centerX = $size / 2;
    $centerY = $size / 2;

    # White circle in center
    $circleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White);
    $graphics.FillEllipse($circleBrush, $centerX - $size/4, $centerY - $size/4, $size/2, $size/2);

    # Blue inner circle
    $innerBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(74, 144, 226));
    $graphics.FillEllipse($innerBrush, $centerX - $size/6, $centerY - $size/6, $size/3, $size/3);

    # Add 'WS' text if large enough
    if ($size -ge 48) {
        $font = New-Object System.Drawing.Font('Arial', $size/6, [System.Drawing.FontStyle]::Bold);
        $textBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White);
        $text = 'WS';
        $textSize = $graphics.MeasureString($text, $font);
        $textX = $centerX - $textSize.Width / 2;
        $textY = $centerY - $textSize.Height / 2;
        $graphics.DrawString($text, $font, $textBrush, $textX, $textY);
    }

    # Save the bitmap
    $bitmap.Save(\"$PSScriptRoot\icon$size.png\", [System.Drawing.Imaging.ImageFormat]::Png);

    # Cleanup
    $graphics.Dispose();
    $bitmap.Dispose();
}

# Create all three sizes
Create-Icon 16;
Create-Icon 48;
Create-Icon 128;

Write-Host 'Icons created successfully!' -ForegroundColor Green;
"

pause