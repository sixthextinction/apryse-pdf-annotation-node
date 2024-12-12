require('dotenv').config()
const { PDFNet } = require('@pdftron/pdfnet-node');

// Part 1: Adding Stamp Annotations
async function addStampAnnotation(doc) {
    const stamper = await PDFNet.Stamper.create(
        PDFNet.Stamper.SizeType.e_relative_scale,
        0.25, // Width as a percentage of the page width
        0.25  // Height as a percentage of the page height
    );

    // Align the stamp to the top-right corner with a slight offset
    await stamper.setAlignment(
        PDFNet.Stamper.HorizontalAlignment.e_horizontal_right,
        PDFNet.Stamper.VerticalAlignment.e_vertical_top
    );
    await stamper.setPosition(0.05, 0.05, true);

    // Add a text stamp
    const textFont = await PDFNet.Font.create(doc, PDFNet.Font.StandardType1Font.e_courier);
    await stamper.setFont(textFont);
    await stamper.setFontColor(await PDFNet.ColorPt.init(1, 0, 0)); // Red
    await stamper.setTextAlignment(PDFNet.Stamper.TextAlignment.e_align_right);
    await stamper.setAsBackground(false); // Ensure it's above other content

    const pages = await PDFNet.PageSet.createRange(1, 4); // Apply to pages 1-4
    await stamper.stampText(doc, "Reviewed by J.Doe", pages);

    // Add an image stamp
    const image = await PDFNet.Image.createFromFile(doc, './draft-stamp.png');
    await stamper.setOpacity(0.1); // 10% opacity
    await stamper.stampImage(doc, image, pages); // Same page range
}

// Part 2: Adding Link Annotations
async function addLinkAnnotations(doc) {
    // Get the total number of pages in the document
    const pageCount = await doc.getPageCount();

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        // Get current page
        const page = await doc.getPage(pageNum);

        // Extract text from page
        const textExtractor = await PDFNet.TextExtractor.create();
        await textExtractor.begin(page); // Begin extraction

        // Start with the first line on page
        let line = await textExtractor.getFirstLine();

        // Loop through all lines
        while (await line.isValid()) {
            let lineText = '';
            const numWords = await line.getNumWords();

            // Extract and concatenate the text of all words in line
            for (let i = 0; i < numWords; i++) {
                const word = await line.getWord(i);
                lineText += (i > 0 ? ' ' : '') + (await word.getString());
            }

            // Get the bounding box/coords of line
            const bbox = await line.getBBox();

            // Check for specific keywords; add hyperlinks if found
            if (lineText.includes("Financial Reporting Standards")) {
                await addHyperlinkToLine(doc, page, bbox, 'https://en.wikipedia.org/wiki/International_Financial_Reporting_Standards');
            } else if (lineText.includes("How to Interpret Financial Data")) {
                await addHyperlinkToLine(doc, page, bbox, 'https://example.com/financial-data');
            } else if (lineText.includes("Best Practices for Legal Compliance")) {
                await addHyperlinkToLine(doc, page, bbox, 'https://example.com/legal-compliance');
            }

            // Move to next line
            line = await line.getNextLine();
        }
    }
}

async function addHyperlinkToLine(doc, page, bbox, url) {
    // Create a “URI” action that links to the specified URL
    const gotoURI = await PDFNet.Action.createURI(doc, url);

    // Define clickable area for link annotation, based on the bounding box (bbox) of target text
    const linkRect = new PDFNet.Rect(bbox.x1, bbox.y1, bbox.x2, bbox.y2);

    // Then create a hyperlink annotation in the defined area
    const hyperlink = await PDFNet.LinkAnnot.create(doc, linkRect);

    // Hyperlink styling; add underline, set color to blue
    const borderStyle = await PDFNet.AnnotBorderStyle.create(PDFNet.AnnotBorderStyle.Style.e_underline, 1, 0, 0);
    await hyperlink.setBorderStyle(borderStyle);
    await hyperlink.setColor(await PDFNet.ColorPt.init(0, 0, 1)); // Blue color

    // Attach the URI action to the hyperlink annotation so clicking it opens the URL
    await hyperlink.setAction(gotoURI);

    // Generate visuals of hyperlink
    await hyperlink.refreshAppearance();

    // Add this hyperlink annotation to the page
    await page.annotPushBack(hyperlink);
}

// Part 3 : Adding Sticky Notes
async function addStickyNote(doc) {
    const pageCount = await doc.getPageCount();

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
        const page = await doc.getPage(pageNum); // Get current page
        // Create a text extractor to extract text from the page
        const textExtractor = await PDFNet.TextExtractor.create();
        await textExtractor.begin(page);

        // Start with first line and loop through them all
        let line = await textExtractor.getFirstLine();
        while (await line.isValid()) {
            const numWords = await line.getNumWords();

            // For each line, loop through each word in it
            for (let wordIndex = 0; wordIndex < numWords; wordIndex++) {
                const word = await line.getWord(wordIndex);
                const wordText = await word.getString();

                // Does this word match "Q3"? 
                // (Bring your own matching logic here)
                if (wordText === "Q3") {
                    // If so, get bounding box/coords for word
                    const bbox = await word.getBBox();

                     // Create a text annotation at that position
                    const annotation = await PDFNet.TextAnnot.create(doc, new PDFNet.Rect(bbox.x1 + 25, bbox.y1, bbox.x2 + 25, bbox.y2)); // ...With slight offset to prevent overlap.
                    // Set content of the sticky note annotation
                    await annotation.setContents('Important: Verify Q3 data.');
                    // Styling
                    await annotation.setColor(await PDFNet.ColorPt.init(1, 1, 0)); // Yellow
                     // Generate visuals of annotation
                    await annotation.refreshAppearance();
                     // Add annotation to page
                    await page.annotPushBack(annotation);

                    return; // Early exit once the first occurrence is annotated
                }
            }
            line = await line.getNextLine(); // Move on to the next line
        }
    }
}

const main = async () => {
    const doc = await PDFNet.PDFDoc.createFromFilePath('./finance-report.pdf');
    await addStampAnnotation(doc); // Add review/approval stamps
    await addLinkAnnotations(doc); // Add link to references
    await addStickyNote(doc);      // Add sticky note to 'Q3'
    await doc.save('./finance-report-annotated.pdf', PDFNet.SDFDoc.SaveOptions.e_linearized);
    console.log('Saved.');
};

PDFNet.runWithCleanup(main, process.env.APRYSE_API_KEY)
    .catch(error => console.error("Apryse library failed to initialize:", error))
    .then(function () {
        PDFNet.shutdown();
    });
