const BLOCKS = {
    paragraph: ({ text }) => <p className="text-body-lg text-body">{text}</p>,
    heading: ({ text }) => <h2 className="font-heading text-heading-1 text-ink">{text}</h2>,
    list: ({ items }) => (
        <ul className="flex list-disc flex-col gap-2 pl-6 text-body-lg text-body">
            {items.map((item, index) => (
                <li key={index}>{item}</li>
            ))}
        </ul>
    ),
};

const ArticleContent = ({ blocks }) => (
    <div className="flex flex-col gap-5">
        {blocks.map((block, index) => {
            const Block = BLOCKS[block.type];
            return Block ? <Block key={index} {...block} /> : null;
        })}
    </div>
);

export default ArticleContent;
