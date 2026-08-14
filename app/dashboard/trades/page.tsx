06:09:17.909 Running build in Washington, D.C., USA (East) – iad1
06:09:17.910 Build machine configuration: 2 cores, 8 GB
06:09:18.044 Cloning github.com/nasirahmadrahmati19-hue/exchange-admin (Branch: main, Commit: d026bf4)
06:09:18.507 Cloning completed: 463.000ms
06:09:18.773 Restored build cache from previous deployment (A2VThnU3TXYevbivuQJbmrBrfhGq)
06:09:19.012 Running "vercel build"
06:09:19.046 Vercel CLI 58.1.0
06:09:19.260 Installing dependencies...
06:09:22.202 
06:09:22.203 up to date in 3s
06:09:22.204 
06:09:22.204 24 packages are looking for funding
06:09:22.204   run `npm fund` for details
06:09:22.290 Detected Next.js version: 14.2.35
06:09:22.294 Running "npm run build"
06:09:22.422 
06:09:22.422 > exchange-admin@0.1.0 build
06:09:22.422 > next build
06:09:22.423 
06:09:23.101   ▲ Next.js 14.2.35
06:09:23.102 
06:09:23.118    Creating an optimized production build ...
06:09:29.663  ✓ Compiled successfully
06:09:29.664    Linting and checking validity of types ...
06:09:35.795 Failed to compile.
06:09:35.796 
06:09:35.797 ./app/dashboard/trades/page.tsx:361:33
06:09:35.797 Type error: Type 'RefObject<HTMLDivElement | null>' is not assignable to type 'LegacyRef<HTMLDivElement> | undefined'.
06:09:35.798   Type 'RefObject<HTMLDivElement | null>' is not assignable to type 'RefObject<HTMLDivElement>'.
06:09:35.798     Type 'HTMLDivElement | null' is not assignable to type 'HTMLDivElement'.
06:09:35.798       Type 'null' is not assignable to type 'HTMLDivElement'.
06:09:35.798 
06:09:35.798   359 |
06:09:35.798   360 |     return (
06:09:35.798 > 361 |       <div className="relative" ref={listRef}>
06:09:35.798       |                                 ^
06:09:35.798   362 |         <input 
06:09:35.798   363 |           value={value} 
06:09:35.798   364 |           onChange={handleInputChange}
06:09:35.829 Next.js build worker exited with code: 1 and signal: null
06:09:35.862 Error: Command "npm run build" exited with 1
