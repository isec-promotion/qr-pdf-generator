// src/App.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import jsPDF from 'jspdf';

// 画像ファイルの型定義
type ImageFile = File & { preview: string };

// 関数: ファイル名からコードを抽出
const getCodeFromFilename = (filename: string): string => {
  return filename.replace(/\.[^/.]+$/, '');
};

function App() {
  // 画像の状態
  const [images, setImages] = useState<ImageFile[]>([]);

  // URLの状態
  const [url, setUrl] = useState<string>('');

  // ファイルのドロップ処理
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const imageFiles: ImageFile[] = acceptedFiles.map((file) =>
      Object.assign(file, {
        preview: URL.createObjectURL(file),
      })
    );
    setImages((prev) => [...prev, ...imageFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
  });

  // クリーンアップ用
  useEffect(() => {
    // コンポーネントのアンマウント時にオブジェクトURLを解放
    return () => {
      images.forEach((file) => URL.revokeObjectURL(file.preview));
    };
  }, [images]);

  const handleCreatePDF = async () => {
    if (images.length === 0) {
      alert('QRコード画像をアップロードしてください。');
      return;
    }

    const doc = new jsPDF({
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const marginX = 10;
    const marginY = 10;
    const cols = 4;
    const rows = 5;
    const cellWidth = (pageWidth - 2 * marginX) / cols;
    const cellHeight = (pageHeight - 2 * marginY) / rows;

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgIndex = i % (cols * rows);
      const pageIndex = Math.floor(i / (cols * rows));

      if (i > 0 && imgIndex === 0) {
        doc.addPage();
      }

      const x = marginX + (imgIndex % cols) * cellWidth;
      const y = marginY + Math.floor(imgIndex / cols) * cellHeight;

      // ファイル名からコードを抽出
      const code = getCodeFromFilename(img.name);

      // 画像のロード
      const imgData = await getImageData(img.preview);

      // 画像のサイズ調整
      const imgProps = doc.getImageProperties(imgData);

      // テキスト用のスペースを確保
      const textHeight = 10; // URLテキストの高さ
      const codeHeight = 10; // コードテキストの高さ
      const availableHeight = cellHeight - textHeight - codeHeight - 4; // 余白を考慮
      const ratio = Math.min(
        cellWidth / imgProps.width,
        availableHeight / imgProps.height
      );
      const imgWidth = imgProps.width * ratio;
      const imgHeight = imgProps.height * ratio;

      // URLテキストの位置
      const urlX = x + cellWidth / 2;
      const urlY = y + textHeight;

      // QRコード画像の位置
      const imgX = x + (cellWidth - imgWidth) / 2;
      const imgY = y + textHeight + 2; // URLテキストの下に配置

      // コードテキストの位置
      const codeX = x + cellWidth / 2;
      const codeY = imgY + imgHeight + 4; // QRコードの下に配置

      // URLテキストを描画（改行対応）
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      const urlLines = doc.splitTextToSize(url, cellWidth - 4); // セル幅に合わせてテキストを分割
      doc.text(urlLines, urlX, urlY, { align: 'center' });

      // QRコード画像を描画
      doc.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight);

      // コードテキストを太字で描画
      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text(code, codeX, codeY, { align: 'center' });

      // フォントを元に戻す
      doc.setFont(undefined, 'normal');
    }

    doc.save('qr_codes.pdf');
  };

  const getImageData = (url: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.setAttribute('crossOrigin', 'anonymous');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve('');
        }
      };
      img.src = url;
    });
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className='max-w-4xl mx-auto p-6'>
      <h1 className='text-3xl font-bold text-center mb-6'>
        QRコード PDFジェネレーター
      </h1>

      {/* URL入力欄 */}
      <div className='mb-6'>
        <label htmlFor='url' className='block text-lg font-medium mb-2'>
          URLを入力してください:
        </label>
        <input
          type='text'
          id='url'
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder='https://example.com/your-qr-code'
          className='w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
        />
      </div>

      {/* ドラッグ＆ドロップエリア */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? 'bg-blue-100' : 'bg-gray-50'
        }`}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p className='text-blue-500'>ここにドロップしてください...</p>
        ) : (
          <p>ドラッグ＆ドロップ、またはクリックして画像を選択</p>
        )}
      </div>

      {/* 画像プレビュー */}
      {images.length > 0 && (
        <div className='mt-8'>
          <h2 className='text-2xl font-semibold mb-4'>
            アップロードされた画像:
          </h2>
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4'>
            {images.map((file, index) => (
              <div key={index} className='relative'>
                <img
                  src={file.preview}
                  alt={`QR Code ${index + 1}`}
                  className='w-full h-24 object-cover rounded'
                />
                <button
                  onClick={() => handleRemoveImage(index)}
                  className='absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600'
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PDF作成ボタン */}
      <button
        onClick={handleCreatePDF}
        className='mt-8 w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600 transition-colors'
      >
        PDFを作成
      </button>
    </div>
  );
}

export default App;
